defmodule Hologram.Runtime.Templatable do
  alias Hologram.Compiler.AST
  alias Hologram.Component

  defmacro __using__(opts \\ []) do
    [
      if opts[:initiable_on_client?] do
        quote do
          @doc """
          Initializes component client data (when run on the client).
          """
          @callback init(%{atom => any}, Component.Client.t()) :: Component.Client.t()
        end
      end,
      quote do
        alias Hologram.Runtime.Templatable

        @doc """
        Initializes component client and server data (when run on the server).
        """
        @callback init(%{atom => any}, Component.Client.t(), Component.Server.t()) ::
                    {Component.Client.t(), Component.Server.t()}
                    | Component.Client.t()
                    | Component.Server.t()

        @doc """
        Returns a template in the form of an anonymous function that given variable bindings returns a DOM.
        """
        @callback template() :: (map -> list)
      end
    ]
  end

  defmacro __before_compile__(_env) do
    quote do
      @doc """
      Returns the list of property definitions for the compiled component.
      """
      @spec __props__() :: list({atom, atom, keyword})
      def __props__, do: @__props__
    end
  end

  @doc """
  Resolves the colocated template path for the given templatable module (page, layout, component) given its file path.
  """
  @spec colocated_template_path(String.t()) :: String.t()
  def colocated_template_path(templatable_file) do
    Path.rootname(templatable_file) <> ".holo"
  end

  @doc """
  Returns the AST of template/0 function definition that uses markup fetched from the give template file.
  If the given template file doesn't exist nil is returned.
  """
  @spec maybe_define_template_fun(String.t(), module) :: AST.t() | nil
  def maybe_define_template_fun(template_path, behaviour) do
    if File.exists?(template_path) do
      markup = File.read!(template_path)

      quote do
        @impl unquote(behaviour)
        def template do
          sigil_H(unquote(markup), [])
        end
      end
    end
  end

  @doc """
  Accumulates the given property definition in __props__ module attribute.
  """
  @spec prop(atom, atom, keyword) :: Macro.t()
  defmacro prop(name, type, opts \\ []) do
    quote do
      Module.put_attribute(__MODULE__, :__props__, {unquote(name), unquote(type), unquote(opts)})
    end
  end

  @doc """
  Puts the given key-value pair to the context.
  """
  @spec put_context(Component.Client.t(), any, any) :: Component.Client.t()
  def put_context(%{context: context} = client, key, value) do
    %{client | context: Map.put(context, key, value)}
  end

  @doc """
  Puts the given key-value entries to the component client state.
  """
  @spec put_state(Component.Client.t(), keyword | map) :: Component.Client.t()
  def put_state(client, entries)

  def put_state(client, entries) when is_list(entries) do
    put_state(client, Enum.into(entries, %{}))
  end

  def put_state(%{state: state} = client, entries) when is_map(entries) do
    %{client | state: Map.merge(state, entries)}
  end

  @doc """
  Puts the given key-value pair to the component client state.
  """
  @spec put_state(Component.Client.t(), atom, any) :: Component.Client.t()
  def put_state(%{state: state} = client, key, value) do
    %{client | state: Map.put(state, key, value)}
  end

  @doc """
  Returns the AST of code that registers __props__ module attribute.
  """
  @spec register_props_accumulator() :: AST.t()
  def register_props_accumulator do
    quote do
      Module.register_attribute(__MODULE__, :__props__, accumulate: true)
    end
  end
end
