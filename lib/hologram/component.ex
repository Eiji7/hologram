defmodule Hologram.Component do
  use Hologram.Runtime.Templatable

  alias Hologram.Component
  alias Hologram.Operation

  defstruct context: %{}, next_command: nil, state: %{}

  @type t :: %__MODULE__{
          context: %{atom => any} | %{{module, atom} => any},
          next_command: Operation.t() | nil,
          state: %{atom => any}
        }

  defmacro __using__(_opts) do
    template_path = colocated_template_path(__CALLER__.file)

    [
      quote do
        import Hologram.Component
        import Hologram.Router.Helpers, only: [asset_path: 1]
        import Hologram.Template, only: [sigil_H: 2]
        import Templatable, only: [prop: 2, prop: 3, put_context: 3, put_state: 2, put_state: 3]

        alias Hologram.Component

        @before_compile Templatable

        @behaviour Component

        @external_resource unquote(template_path)

        @doc """
        Returns true to indicate that the callee module is a component module (has "use Hologram.Component" directive).

        ## Examples

            iex> __is_hologram_component__()
            true
        """
        @spec __is_hologram_component__() :: boolean
        def __is_hologram_component__, do: true

        @impl Component
        def init(_props, component, server), do: {component, server}

        defoverridable init: 3
      end,
      Templatable.maybe_define_template_fun(template_path, __MODULE__),
      Templatable.register_props_accumulator()
    ]
  end

  @doc """
  Resolves the colocated template path for the given component module given its file path.
  """
  @spec colocated_template_path(String.t()) :: String.t()
  def colocated_template_path(templatable_file) do
    Path.rootname(templatable_file) <> ".holo"
  end
end
