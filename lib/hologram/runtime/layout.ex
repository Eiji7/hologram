defmodule Hologram.Layout do
  use Hologram.Runtime.Templatable
  alias Hologram.Layout

  defmacro __using__(_opts) do
    template_path = Templatable.colocated_template_path(__CALLER__.file)

    [
      quote do
        import Hologram.Layout
        import Hologram.Router.Helpers, only: [asset_path: 1]
        import Hologram.Template, only: [sigil_H: 2]
        import Templatable, only: [prop: 2, prop: 3, put_context: 3, put_state: 2, put_state: 3]

        alias Hologram.Layout

        @before_compile Templatable

        @behaviour Layout

        @external_resource unquote(template_path)

        @doc """
        Returns true to indicate that the callee module is a layout module (has "use Hologram.Layout" directive).

        ## Examples

            iex> __is_hologram_layout__()
            true
        """
        @spec __is_hologram_layout__() :: boolean
        def __is_hologram_layout__, do: true

        @impl Layout
        def init(_props, client, server), do: {client, server}

        defoverridable init: 3
      end,
      Templatable.maybe_define_template_fun(template_path, __MODULE__),
      Templatable.register_props_accumulator()
    ]
  end
end
