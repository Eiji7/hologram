defmodule Hologram.Compiler.CallGraph do
  alias Hologram.Commons.PLT
  alias Hologram.Commons.Reflection
  alias Hologram.Commons.SerializationUtils
  alias Hologram.Commons.TaskUtils
  alias Hologram.Compiler.CallGraph
  alias Hologram.Compiler.IR

  defstruct pid: nil
  @type t :: %CallGraph{pid: pid}

  @type vertex :: module | {module, atom, integer}

  @doc """
  Adds an edge between two vertices in the call graph.
  """
  @spec add_edge(CallGraph.t(), vertex, vertex) :: CallGraph.t()
  def add_edge(%{pid: pid} = call_graph, from_vertex, to_vertex) do
    Agent.update(pid, &Graph.add_edge(&1, from_vertex, to_vertex))
    call_graph
  end

  @doc """
  Adds multiple edges to the call graph.
  """
  @spec add_edges(CallGraph.t(), list(Graph.Edge.t())) :: CallGraph.t()
  def add_edges(%{pid: pid} = call_graph, edges) do
    Agent.update(pid, &Graph.add_edges(&1, edges))
    call_graph
  end

  @doc """
  Adds the vertex to the call graph.
  """
  @spec add_vertex(CallGraph.t(), vertex) :: CallGraph.t()
  def add_vertex(%{pid: pid} = call_graph, vertex) do
    Agent.update(pid, &Graph.add_vertex(&1, vertex))
    call_graph
  end

  @doc """
  Builds a call graph from IR.
  """
  @spec build(CallGraph.t(), IR.t(), vertex | nil) :: CallGraph.t()
  def build(call_graph, ir, from_vertex \\ nil)

  def build(call_graph, %IR.AtomType{value: value}, from_vertex) do
    if Reflection.elixir_module?(value) do
      add_edge(call_graph, from_vertex, value)
      maybe_add_protocol_call_graph_edges(call_graph, value)
      maybe_add_templatable_call_graph_edges(call_graph, value)
    end

    call_graph
  end

  def build(
        call_graph,
        %IR.FunctionDefinition{name: name, arity: arity, clause: clause},
        from_vertex
      ) do
    fun_def_vertex = {from_vertex, name, arity}

    call_graph
    |> add_vertex(fun_def_vertex)
    |> build(clause, fun_def_vertex)
  end

  def build(
        call_graph,
        %IR.LocalFunctionCall{function: function, args: args},
        {module, _function, _arity} = from_vertex
      ) do
    to_vertex = {module, function, Enum.count(args)}
    add_edge(call_graph, from_vertex, to_vertex)

    build(call_graph, args, from_vertex)
  end

  def build(
        call_graph,
        %IR.ModuleDefinition{module: %IR.AtomType{value: module}, body: body},
        _from_vertex
      ) do
    maybe_add_templatable_call_graph_edges(call_graph, module)
    build(call_graph, body, module)
  end

  def build(
        call_graph,
        %IR.RemoteFunctionCall{
          module: %IR.AtomType{value: :erlang},
          function: :apply,
          args: [
            %IR.AtomType{value: module},
            %IR.AtomType{value: function},
            %IR.ListType{data: args}
          ]
        },
        from_vertex
      ) do
    to_vertex = {module, function, Enum.count(args)}
    add_edge(call_graph, from_vertex, to_vertex)

    build(call_graph, args, from_vertex)
  end

  def build(
        call_graph,
        %IR.RemoteFunctionCall{
          module: %IR.AtomType{value: module},
          function: function,
          args: args
        },
        from_vertex
      ) do
    to_vertex = {module, function, Enum.count(args)}
    add_edge(call_graph, from_vertex, to_vertex)

    build(call_graph, args, from_vertex)
  end

  def build(call_graph, list, from_vertex) when is_list(list) do
    Enum.each(list, &build(call_graph, &1, from_vertex))
    call_graph
  end

  def build(call_graph, map, from_vertex) when is_map(map) do
    map
    |> Map.to_list()
    |> Enum.each(fn {key, value} ->
      build(call_graph, key, from_vertex)
      build(call_graph, value, from_vertex)
    end)

    call_graph
  end

  def build(call_graph, tuple, from_vertex) when is_tuple(tuple) do
    tuple
    |> Tuple.to_list()
    |> Enum.each(&build(call_graph, &1, from_vertex))

    call_graph
  end

  def build(call_graph, _ir, _from_vertex), do: call_graph

  @doc """
  Returns a clone of the given call graph.
  """
  @spec clone(CallGraph.t()) :: CallGraph.t()
  def clone(call_graph) do
    graph = get_graph(call_graph)
    put_graph(start(), graph)
  end

  @doc """
  Serializes the call graph and writes it to a file.
  """
  @spec dump(CallGraph.t(), String.t()) :: CallGraph.t()
  def dump(call_graph, path) do
    data =
      call_graph
      |> get_graph()
      |> SerializationUtils.serialize()

    path
    |> Path.dirname()
    |> File.mkdir_p!()

    File.write!(path, data)

    call_graph
  end

  @doc """
  Returns graph edges.
  """
  @spec edges(CallGraph.t()) :: list(Graph.Edge.t())
  def edges(%{pid: pid}) do
    Agent.get(pid, &Graph.edges/1)
  end

  @doc """
  Returns the underlying libgraph %Graph{} struct containing vertices and edges data.
  """
  @spec get_graph(CallGraph.t()) :: Graph.t()
  def get_graph(%{pid: pid}) do
    Agent.get(pid, & &1)
  end

  @doc """
  Checks if an edge exists between two given vertices in the call graph.
  """
  @spec has_edge?(CallGraph.t(), vertex, vertex) :: boolean
  def has_edge?(call_graph, from_vertex, to_vertex) do
    call_graph
    |> get_graph()
    |> Graph.edge(from_vertex, to_vertex)
    |> is_struct(Graph.Edge)
  end

  @doc """
  Checks if the given vertex exists in the call graph.
  """
  @spec has_vertex?(CallGraph.t(), vertex) :: boolean
  def has_vertex?(%{pid: pid}, vertex) do
    Agent.get(pid, &Graph.has_vertex?(&1, vertex))
  end

  @doc """
  Returns the edges in which the second vertex is either the given module or a function from the given module,
  and the first vertex is a function from a different module.
  """
  @spec inbound_remote_edges(CallGraph.t(), module) :: list(Graph.Edge.t())
  def inbound_remote_edges(call_graph, to_module) do
    call_graph
    |> module_vertices(to_module)
    |> Enum.reduce([], fn vertex, acc ->
      call_graph
      |> inbound_edges(vertex)
      |> Enum.filter(fn
        %{v1: {from_module, _fun, _arity}} when from_module != to_module -> true
        _fallback -> false
      end)
      |> Enum.concat(acc)
    end)
  end

  @doc """
  Loads the graph from the given dump file.
  """
  @spec load(CallGraph.t(), String.t()) :: CallGraph.t()
  def load(call_graph, dump_path) do
    graph =
      dump_path
      |> File.read!()
      |> SerializationUtils.deserialize(true)

    put_graph(call_graph, graph)
  end

  @doc """
  Loads the graph from the given dump file if the file exists.
  """
  @spec maybe_load(CallGraph.t(), String.t()) :: CallGraph.t()
  def maybe_load(call_graph, dump_path) do
    if File.exists?(dump_path) do
      load(call_graph, dump_path)
    else
      call_graph
    end
  end

  @doc """
  Returns the list of vertices that are MFAs belonging to the given module.
  """
  @spec module_vertices(CallGraph.t(), module) :: list(vertex)
  def module_vertices(call_graph, module) do
    call_graph
    |> vertices()
    |> Enum.filter(fn
      ^module -> true
      {^module, _fun, _arity} -> true
      _fallback -> false
    end)
  end

  @doc """
  Given a diff of changes, updates the call graph
  by deleting the graph paths of modules that have been removed,
  rebuilding the graph paths of modules that have been updated,
  and adding the graph paths of modules that have been added.
  """
  @spec patch(CallGraph.t(), PLT.t(), map) :: CallGraph.t()
  def patch(call_graph, ir_plt, diff) do
    remove_tasks =
      TaskUtils.async_many(diff.removed_modules, &remove_module_vertices(call_graph, &1))

    update_tasks =
      TaskUtils.async_many(diff.updated_modules, fn module ->
        inbound_remote_edges = inbound_remote_edges(call_graph, module)
        remove_module_vertices(call_graph, module)
        build_for_module(call_graph, ir_plt, module)
        add_edges(call_graph, inbound_remote_edges)
      end)

    add_tasks =
      TaskUtils.async_many(diff.added_modules, &build_for_module(call_graph, ir_plt, &1))

    Task.await_many(remove_tasks, :infinity)
    Task.await_many(update_tasks, :infinity)
    Task.await_many(add_tasks, :infinity)

    call_graph
  end

  @doc """
  Replace the state of underlying Agent process with the given graph.
  """
  @spec put_graph(CallGraph.t(), Graph.t()) :: CallGraph.t()
  def put_graph(%{pid: pid} = call_graph, graph) do
    Agent.update(pid, fn _state -> graph end)
    call_graph
  end

  @doc """
  Lists vertices that are reachable from the given call graph vertex or vertices.
  """
  @spec reachable(CallGraph.t(), vertex | list(vertex)) :: list(vertex)
  def reachable(call_graph, vertex_or_vertices)

  def reachable(%{pid: pid}, vertices) when is_list(vertices) do
    pid
    |> Agent.get(&Graph.reachable(&1, vertices))
    |> Enum.reject(&(&1 == nil))
  end

  def reachable(call_graph, vertex) do
    reachable(call_graph, [vertex])
  end

  @doc """
  Lists MFAs that are reachable from the given entry MFA or MFAs.
  """
  @spec reachable_mfas(CallGraph.t(), mfa | list(mfa)) :: list(mfa)
  def reachable_mfas(call_graph, entry_mfa_or_mfas) do
    call_graph
    |> reachable(entry_mfa_or_mfas)
    |> Enum.filter(&is_tuple/1)
  end

  @doc """
  Removes the vertex from the call graph.
  """
  @spec remove_vertex(CallGraph.t(), vertex) :: CallGraph.t()
  def remove_vertex(%{pid: pid} = call_graph, vertex) do
    Agent.update(pid, &Graph.delete_vertex(&1, vertex))
    call_graph
  end

  @doc """
  Removes the vertices from the call graph.
  """
  @spec remove_vertices(CallGraph.t(), list(vertex)) :: CallGraph.t()
  def remove_vertices(%{pid: pid} = call_graph, vertices) do
    Agent.update(pid, &Graph.delete_vertices(&1, vertices))
    call_graph
  end

  @doc """
  Returns sorted graph edges.
  """
  @spec sorted_edges(CallGraph.t()) :: list(Graph.Edge.t())
  def sorted_edges(call_graph) do
    call_graph
    |> edges()
    |> Enum.sort()
  end

  @doc """
  Returns sorted graph vertices.
  """
  @spec sorted_vertices(CallGraph.t()) :: list(vertex)
  def sorted_vertices(call_graph) do
    call_graph
    |> vertices()
    |> Enum.sort()
  end

  @doc """
  Starts a new CallGraph agent with an initial empty graph.
  """
  @spec start() :: CallGraph.t()
  def start do
    {:ok, pid} = Agent.start_link(fn -> Graph.new() end)
    %CallGraph{pid: pid}
  end

  @doc """
  Returns graph vertices.
  """
  @spec vertices(CallGraph.t()) :: list(vertex)
  def vertices(%{pid: pid}) do
    Agent.get(pid, &Graph.vertices/1)
  end

  # A component module can be passed as a prop to another component, allowing dynamic usage.
  # In such cases, when this scenario is identified, it becomes necessary
  # to include the entire component on the client side.
  # This is because we lack precise information about which specific component functions will be used.
  defp add_component_call_graph_edges(call_graph, module) do
    add_edge(call_graph, module, {module, :__props__, 0})
    add_edge(call_graph, module, {module, :action, 3})
    add_edge(call_graph, module, {module, :init, 2})
    add_edge(call_graph, module, {module, :template, 0})
  end

  # A page module can be passed as a prop to a component, enabling the component to use its __route__/0 function.
  # This can be particularly useful, for example, in constructing the page's URL.
  defp add_page_call_graph_edges(call_graph, module) do
    add_edge(call_graph, module, {module, :__route__, 0})
  end

  defp add_protocol_call_graph_edges(call_graph, module) do
    funs = module.__protocol__(:functions)
    impls = Reflection.list_protocol_implementations(module)

    Enum.each(impls, fn impl ->
      Enum.each(funs, fn {name, arity} ->
        add_edge(call_graph, {module, name, arity}, {impl, :__impl__, 1})
        add_edge(call_graph, {module, name, arity}, {impl, name, arity})
      end)
    end)
  end

  defp build_for_module(call_graph, ir_plt, module) do
    module_def = PLT.get!(ir_plt, module)
    build(call_graph, module_def)
  end

  defp inbound_edges(%{pid: pid}, vertex) do
    Agent.get(pid, &Graph.in_edges(&1, vertex))
  end

  defp maybe_add_protocol_call_graph_edges(call_graph, module) do
    if Reflection.protocol?(module) do
      add_protocol_call_graph_edges(call_graph, module)
    end
  end

  defp maybe_add_templatable_call_graph_edges(call_graph, module) do
    if Reflection.page?(module) do
      add_page_call_graph_edges(call_graph, module)
    end

    if Reflection.component?(module) do
      add_component_call_graph_edges(call_graph, module)
    end
  end

  defp remove_module_vertices(call_graph, module) do
    call_graph
    |> module_vertices(module)
    |> Enum.each(&remove_vertex(call_graph, &1))
  end
end
