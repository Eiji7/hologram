defmodule Hologram.Compiler.CallGraphTest do
  use Hologram.Test.BasicCase, async: true
  import Hologram.Compiler.CallGraph

  alias Hologram.Commons.PLT
  alias Hologram.Commons.Reflection
  alias Hologram.Commons.SerializationUtils
  alias Hologram.Compiler.CallGraph
  alias Hologram.Compiler.IR

  alias Hologram.Test.Fixtures.Compiler.CallGraph.Module1
  alias Hologram.Test.Fixtures.Compiler.CallGraph.Module10
  alias Hologram.Test.Fixtures.Compiler.CallGraph.Module11
  alias Hologram.Test.Fixtures.Compiler.CallGraph.Module13
  alias Hologram.Test.Fixtures.Compiler.CallGraph.Module2
  alias Hologram.Test.Fixtures.Compiler.CallGraph.Module3
  alias Hologram.Test.Fixtures.Compiler.CallGraph.Module4
  alias Hologram.Test.Fixtures.Compiler.CallGraph.Module5
  alias Hologram.Test.Fixtures.Compiler.CallGraph.Module6
  alias Hologram.Test.Fixtures.Compiler.CallGraph.Module7
  alias Hologram.Test.Fixtures.Compiler.CallGraph.Module8
  alias Hologram.Test.Fixtures.Compiler.CallGraph.Module9

  @tmp_dir Reflection.tmp_dir()
  @dump_dir "#{@tmp_dir}/#{__MODULE__}"
  @dump_path "#{@dump_dir}/test.bin"

  setup do
    clean_dir(@dump_dir)
    [call_graph: start()]
  end

  test "add_edge/3", %{call_graph: call_graph} do
    assert add_edge(call_graph, :vertex_1, :vertex_2) == call_graph

    graph = get_graph(call_graph)

    assert Graph.edge(graph, :vertex_1, :vertex_2) == %Graph.Edge{
             v1: :vertex_1,
             v2: :vertex_2,
             weight: 1,
             label: nil
           }
  end

  test "add_edges/2", %{call_graph: call_graph} do
    edges = [Graph.Edge.new(:a, :b), Graph.Edge.new(:c, :d)]

    assert add_edges(call_graph, edges) == call_graph
    assert edges(call_graph) == edges
  end

  test "add_vertex/2", %{call_graph: call_graph} do
    assert add_vertex(call_graph, :vertex_3) == call_graph

    graph = get_graph(call_graph)
    assert Graph.has_vertex?(graph, :vertex_3)
  end

  describe "build/3" do
    test "atom type ir, which is not an alias", %{call_graph: call_graph} do
      ir = %IR.AtomType{value: :abc}
      assert build(call_graph, ir, :vertex_1) == call_graph

      assert vertices(call_graph) == []
      assert edges(call_graph) == []
    end

    test "atom type ir, which as an alias of a non-existing module", %{call_graph: call_graph} do
      ir = %IR.AtomType{value: Aaa.Bbb}
      assert build(call_graph, ir, :vertex_1) == call_graph

      assert vertices(call_graph) == []
      assert edges(call_graph) == []
    end

    test "atom type ir, which is an alias of an existing non-templatable module", %{
      call_graph: call_graph
    } do
      ir = %IR.AtomType{value: Module1}
      assert build(call_graph, ir, :vertex_1) == call_graph

      assert sorted_vertices(call_graph) == [Module1, :vertex_1]

      assert edges(call_graph) == [
               %Graph.Edge{
                 v1: :vertex_1,
                 v2: Module1,
                 weight: 1,
                 label: nil
               }
             ]
    end

    test "atom type ir, which is an alias of a page module", %{call_graph: call_graph} do
      ir = %IR.AtomType{value: Module2}
      assert build(call_graph, ir, :vertex_1) == call_graph

      assert sorted_vertices(call_graph) == [
               Module2,
               :vertex_1,
               {Module2, :__route__, 0}
             ]

      assert sorted_edges(call_graph) == [
               %Graph.Edge{
                 v1: Module2,
                 v2: {Module2, :__route__, 0},
                 weight: 1,
                 label: nil
               },
               %Graph.Edge{
                 v1: :vertex_1,
                 v2: Module2,
                 weight: 1,
                 label: nil
               }
             ]
    end

    test "atom type ir, which is an alias of a layout module", %{call_graph: call_graph} do
      ir = %IR.AtomType{value: Module3}
      assert build(call_graph, ir, :vertex_1) == call_graph

      assert sorted_vertices(call_graph) == [
               Module3,
               :vertex_1,
               {Module3, :__props__, 0},
               {Module3, :action, 3},
               {Module3, :init, 2},
               {Module3, :template, 0}
             ]

      assert sorted_edges(call_graph) == [
               %Graph.Edge{v1: Module3, v2: {Module3, :__props__, 0}, weight: 1, label: nil},
               %Graph.Edge{v1: Module3, v2: {Module3, :action, 3}, weight: 1, label: nil},
               %Graph.Edge{v1: Module3, v2: {Module3, :init, 2}, weight: 1, label: nil},
               %Graph.Edge{v1: Module3, v2: {Module3, :template, 0}, weight: 1, label: nil},
               %Graph.Edge{v1: :vertex_1, v2: Module3, weight: 1, label: nil}
             ]
    end

    test "atom type ir, which is an alias of a component module", %{call_graph: call_graph} do
      ir = %IR.AtomType{value: Module4}
      assert build(call_graph, ir, :vertex_1) == call_graph

      assert sorted_vertices(call_graph) == [
               Module4,
               :vertex_1,
               {Module4, :__props__, 0},
               {Module4, :action, 3},
               {Module4, :init, 2},
               {Module4, :template, 0}
             ]

      assert sorted_edges(call_graph) == [
               %Graph.Edge{
                 v1: Module4,
                 v2: {Module4, :__props__, 0},
                 weight: 1,
                 label: nil
               },
               %Graph.Edge{
                 v1: Module4,
                 v2: {Module4, :action, 3},
                 weight: 1,
                 label: nil
               },
               %Graph.Edge{
                 v1: Module4,
                 v2: {Module4, :init, 2},
                 weight: 1,
                 label: nil
               },
               %Graph.Edge{
                 v1: Module4,
                 v2: {Module4, :template, 0},
                 weight: 1,
                 label: nil
               },
               %Graph.Edge{
                 v1: :vertex_1,
                 v2: Module4,
                 weight: 1,
                 label: nil
               }
             ]
    end

    test "function definition ir, with outbound vertices", %{call_graph: call_graph} do
      ir = %IR.FunctionDefinition{
        name: :my_fun,
        arity: 2,
        visibility: :public,
        clause: %IR.FunctionClause{
          params: [%IR.Variable{name: :x}, %IR.Variable{name: :y}],
          guards: [%IR.AtomType{value: Module5}],
          body: %IR.Block{
            expressions: [
              %IR.AtomType{value: Module6},
              %IR.AtomType{value: Module7}
            ]
          }
        }
      }

      assert build(call_graph, ir, Module1) == call_graph

      assert sorted_vertices(call_graph) == [
               Module5,
               Module6,
               Module7,
               {Module1, :my_fun, 2}
             ]

      assert sorted_edges(call_graph) == [
               %Graph.Edge{
                 v1: {Module1, :my_fun, 2},
                 v2: Module5,
                 weight: 1,
                 label: nil
               },
               %Graph.Edge{
                 v1: {Module1, :my_fun, 2},
                 v2: Module6,
                 weight: 1,
                 label: nil
               },
               %Graph.Edge{
                 v1: {Module1, :my_fun, 2},
                 v2: Module7,
                 weight: 1,
                 label: nil
               }
             ]
    end

    test "function definition ir, without outbound vertices", %{call_graph: call_graph} do
      ir = %IR.FunctionDefinition{
        name: :my_fun,
        arity: 2,
        visibility: :public,
        clause: %IR.FunctionClause{
          params: [%IR.Variable{name: :x}, %IR.Variable{name: :y}],
          guards: [],
          body: %IR.Block{
            expressions: [
              %IR.AtomType{value: :ok}
            ]
          }
        }
      }

      assert build(call_graph, ir, Module1) == call_graph

      assert sorted_vertices(call_graph) == [{Module1, :my_fun, 2}]

      assert sorted_edges(call_graph) == []
    end

    test "list", %{call_graph: call_graph} do
      list = [%IR.AtomType{value: Module1}, %IR.AtomType{value: Module5}]
      assert build(call_graph, list, :vertex_1) == call_graph

      assert sorted_vertices(call_graph) == [Module1, Module5, :vertex_1]

      assert sorted_edges(call_graph) == [
               %Graph.Edge{
                 v1: :vertex_1,
                 v2: Module1,
                 weight: 1,
                 label: nil
               },
               %Graph.Edge{
                 v1: :vertex_1,
                 v2: Module5,
                 weight: 1,
                 label: nil
               }
             ]
    end

    test "local function call ir", %{call_graph: call_graph} do
      ir = %IR.LocalFunctionCall{
        function: :my_fun_2,
        args: [
          %IR.AtomType{value: Module5},
          %IR.AtomType{value: Module6},
          %IR.AtomType{value: Module7}
        ]
      }

      assert build(call_graph, ir, {Module1, :my_fun_1, 4}) == call_graph

      assert sorted_vertices(call_graph) == [
               Module5,
               Module6,
               Module7,
               {Module1, :my_fun_1, 4},
               {Module1, :my_fun_2, 3}
             ]

      assert sorted_edges(call_graph) == [
               %Graph.Edge{
                 v1: {Module1, :my_fun_1, 4},
                 v2: Module5,
                 weight: 1,
                 label: nil
               },
               %Graph.Edge{
                 v1: {Module1, :my_fun_1, 4},
                 v2: Module6,
                 weight: 1,
                 label: nil
               },
               %Graph.Edge{
                 v1: {Module1, :my_fun_1, 4},
                 v2: Module7,
                 weight: 1,
                 label: nil
               },
               %Graph.Edge{
                 v1: {Module1, :my_fun_1, 4},
                 v2: {Module1, :my_fun_2, 3},
                 weight: 1,
                 label: nil
               }
             ]
    end

    test "map", %{call_graph: call_graph} do
      map = %{
        %IR.AtomType{value: Module1} => %IR.AtomType{value: Module5},
        %IR.AtomType{value: Module6} => %IR.AtomType{value: Module7}
      }

      assert build(call_graph, map, :vertex_1) == call_graph

      assert sorted_vertices(call_graph) == [Module1, Module5, Module6, Module7, :vertex_1]

      assert sorted_edges(call_graph) == [
               %Graph.Edge{
                 v1: :vertex_1,
                 v2: Module1,
                 weight: 1,
                 label: nil
               },
               %Graph.Edge{
                 v1: :vertex_1,
                 v2: Module5,
                 weight: 1,
                 label: nil
               },
               %Graph.Edge{
                 v1: :vertex_1,
                 v2: Module6,
                 weight: 1,
                 label: nil
               },
               %Graph.Edge{
                 v1: :vertex_1,
                 v2: Module7,
                 weight: 1,
                 label: nil
               }
             ]
    end

    test "module definition ir", %{call_graph: call_graph} do
      ir = %IR.ModuleDefinition{
        module: %IR.AtomType{value: Module11},
        body: %IR.Block{
          expressions: [
            %IR.AtomType{value: Module5},
            %IR.AtomType{value: Module6}
          ]
        }
      }

      assert build(call_graph, ir) == call_graph

      assert sorted_vertices(call_graph) == [
               Module11,
               Module5,
               Module6,
               {Module11, :__route__, 0}
             ]

      assert sorted_edges(call_graph) == [
               %Graph.Edge{
                 v1: Module11,
                 v2: Module5,
                 weight: 1,
                 label: nil
               },
               %Graph.Edge{
                 v1: Module11,
                 v2: Module6,
                 weight: 1,
                 label: nil
               },
               %Graph.Edge{
                 v1: Module11,
                 v2: {Module11, :__route__, 0},
                 weight: 1,
                 label: nil
               }
             ]
    end

    test "remote function call ir, module field as an atom", %{call_graph: call_graph} do
      ir = %IR.RemoteFunctionCall{
        module: %IR.AtomType{value: Module5},
        function: :my_fun_2,
        args: [
          %IR.AtomType{value: Module6},
          %IR.AtomType{value: Module7},
          %IR.AtomType{value: Module8}
        ]
      }

      assert build(call_graph, ir, {Module1, :my_fun_1, 4}) == call_graph

      assert sorted_vertices(call_graph) == [
               Module6,
               Module7,
               Module8,
               {Module1, :my_fun_1, 4},
               {Module5, :my_fun_2, 3}
             ]

      assert sorted_edges(call_graph) == [
               %Graph.Edge{
                 v1: {Module1, :my_fun_1, 4},
                 v2: Module6,
                 weight: 1,
                 label: nil
               },
               %Graph.Edge{
                 v1: {Module1, :my_fun_1, 4},
                 v2: Module7,
                 weight: 1,
                 label: nil
               },
               %Graph.Edge{
                 v1: {Module1, :my_fun_1, 4},
                 v2: Module8,
                 weight: 1,
                 label: nil
               },
               %Graph.Edge{
                 v1: {Module1, :my_fun_1, 4},
                 v2: {Module5, :my_fun_2, 3},
                 weight: 1,
                 label: nil
               }
             ]
    end

    test "remote function call ir, module field is a variable", %{call_graph: call_graph} do
      ir = %IR.RemoteFunctionCall{
        module: %IR.Variable{name: :my_var},
        function: :my_fun_2,
        args: [
          %IR.AtomType{value: Module6},
          %IR.AtomType{value: Module7},
          %IR.AtomType{value: Module8}
        ]
      }

      assert build(call_graph, ir, {Module1, :my_fun_1, 4}) == call_graph

      assert sorted_vertices(call_graph) == [
               Module6,
               Module7,
               Module8,
               {Module1, :my_fun_1, 4}
             ]

      assert sorted_edges(call_graph) == [
               %Graph.Edge{
                 v1: {Module1, :my_fun_1, 4},
                 v2: Module6,
                 weight: 1,
                 label: nil
               },
               %Graph.Edge{
                 v1: {Module1, :my_fun_1, 4},
                 v2: Module7,
                 weight: 1,
                 label: nil
               },
               %Graph.Edge{
                 v1: {Module1, :my_fun_1, 4},
                 v2: Module8,
                 weight: 1,
                 label: nil
               }
             ]
    end

    test "remote function call using Kernel.apply/3, module and function fields are both atoms",
         %{
           call_graph: call_graph
         } do
      ir = %IR.RemoteFunctionCall{
        module: %IR.AtomType{value: :erlang},
        function: :apply,
        args: [
          %IR.AtomType{value: DateTime},
          %IR.AtomType{value: :utc_now},
          %IR.ListType{
            data: [%IR.AtomType{value: Calendar.ISO}]
          }
        ]
      }

      assert build(call_graph, ir, {Module1, :my_fun_1, 4}) == call_graph

      assert sorted_vertices(call_graph) == [
               Calendar.ISO,
               {DateTime, :utc_now, 1},
               {Module1, :my_fun_1, 4}
             ]

      assert sorted_edges(call_graph) == [
               %Graph.Edge{
                 v1: {Module1, :my_fun_1, 4},
                 v2: Calendar.ISO,
                 weight: 1,
                 label: nil
               },
               %Graph.Edge{
                 v1: {Module1, :my_fun_1, 4},
                 v2: {DateTime, :utc_now, 1},
                 weight: 1,
                 label: nil
               }
             ]
    end

    test "remote function call using Kernel.apply/3, module field is an atom, function field is not an atom",
         %{
           call_graph: call_graph
         } do
      ir = %IR.RemoteFunctionCall{
        module: %IR.AtomType{value: :erlang},
        function: :apply,
        args: [
          %IR.AtomType{value: DateTime},
          %IR.Variable{name: :my_fun},
          %IR.ListType{
            data: [%IR.AtomType{value: Calendar.ISO}]
          }
        ]
      }

      assert build(call_graph, ir, {Module1, :my_fun_1, 4}) == call_graph

      assert sorted_vertices(call_graph) == [
               Calendar.ISO,
               DateTime,
               {Module1, :my_fun_1, 4},
               {:erlang, :apply, 3}
             ]

      assert sorted_edges(call_graph) == [
               %Graph.Edge{
                 v1: {Module1, :my_fun_1, 4},
                 v2: Calendar.ISO,
                 weight: 1,
                 label: nil
               },
               %Graph.Edge{
                 v1: {Module1, :my_fun_1, 4},
                 v2: DateTime,
                 weight: 1,
                 label: nil
               },
               %Graph.Edge{
                 v1: {Module1, :my_fun_1, 4},
                 v2: {:erlang, :apply, 3},
                 weight: 1,
                 label: nil
               }
             ]
    end

    test "remote function call using Kernel.apply/3, module field is not an atom, function field is an atom",
         %{
           call_graph: call_graph
         } do
      ir = %IR.RemoteFunctionCall{
        module: %IR.AtomType{value: :erlang},
        function: :apply,
        args: [
          %IR.Variable{name: :module},
          %IR.AtomType{value: :utc_now},
          %IR.ListType{
            data: [%IR.AtomType{value: Calendar.ISO}]
          }
        ]
      }

      assert build(call_graph, ir, {Module1, :my_fun_1, 4}) == call_graph

      assert sorted_vertices(call_graph) == [
               Calendar.ISO,
               {Module1, :my_fun_1, 4},
               {:erlang, :apply, 3}
             ]

      assert sorted_edges(call_graph) == [
               %Graph.Edge{
                 v1: {Module1, :my_fun_1, 4},
                 v2: Calendar.ISO,
                 weight: 1,
                 label: nil
               },
               %Graph.Edge{
                 v1: {Module1, :my_fun_1, 4},
                 v2: {:erlang, :apply, 3},
                 weight: 1,
                 label: nil
               }
             ]
    end

    test "tuple", %{call_graph: call_graph} do
      tuple = {%IR.AtomType{value: Module1}, %IR.AtomType{value: Module5}}
      assert build(call_graph, tuple, :vertex_1) == call_graph

      assert sorted_vertices(call_graph) == [Module1, Module5, :vertex_1]

      assert sorted_edges(call_graph) == [
               %Graph.Edge{
                 v1: :vertex_1,
                 v2: Module1,
                 weight: 1,
                 label: nil
               },
               %Graph.Edge{
                 v1: :vertex_1,
                 v2: Module5,
                 weight: 1,
                 label: nil
               }
             ]
    end

    test "protocol (implementation edges are added)", %{call_graph: call_graph} do
      ir = IR.for_module(String.Chars)
      build(call_graph, ir)

      from_vertex = {String.Chars, :to_string, 1}

      assert has_edge?(call_graph, from_vertex, {String.Chars.Atom, :__impl__, 1})

      assert has_edge?(call_graph, from_vertex, {String.Chars.Atom, :to_string, 1})

      assert has_edge?(
               call_graph,
               from_vertex,
               {String.Chars.Hologram.Test.Fixtures.Compiler.CallGraph.Module12, :__impl__, 1}
             )

      assert has_edge?(
               call_graph,
               from_vertex,
               {String.Chars.Hologram.Test.Fixtures.Compiler.CallGraph.Module12, :to_string, 1}
             )
    end
  end

  test "clone/1", %{call_graph: call_graph} do
    assert %CallGraph{} = call_graph_clone = clone(call_graph)

    refute call_graph_clone == call_graph
    assert get_graph(call_graph) == get_graph(call_graph_clone)
  end

  describe "dump/2" do
    test "creates nested path dirs if they don't exist", %{call_graph: call_graph} do
      dump_dir = "#{@dump_dir}/nested_1/_nested_2/nested_3"
      dump_path = "#{dump_dir}/test.bin"

      assert dump(call_graph, dump_path) == call_graph
      assert File.exists?(dump_dir)
    end

    test "writes serialized graph to the given file", %{call_graph: call_graph} do
      add_edge(call_graph, :vertex_1, :vertex_2)
      graph = get_graph(call_graph)

      assert dump(call_graph, @dump_path) == call_graph

      deserialized_graph =
        @dump_path
        |> File.read!()
        |> SerializationUtils.deserialize()

      assert deserialized_graph == graph
    end
  end

  test "edges/1", %{call_graph: call_graph} do
    call_graph
    |> add_edge(:vertex_4, :vertex_5)
    |> add_vertex(:vertex_1)
    |> add_edge(:vertex_2, :vertex_3)

    result = edges(call_graph)

    assert Enum.count(result) == 2
    assert %Graph.Edge{v1: :vertex_2, v2: :vertex_3, weight: 1, label: nil} in result
    assert %Graph.Edge{v1: :vertex_4, v2: :vertex_5, weight: 1, label: nil} in result
  end

  test "get_graph/1", %{call_graph: call_graph} do
    assert %Graph{} = get_graph(call_graph)
  end

  describe "has_edge?/3" do
    test "has the given edge", %{call_graph: call_graph} do
      add_edge(call_graph, :vertex_1, :vertex_2)
      assert has_edge?(call_graph, :vertex_1, :vertex_2)
    end

    test "doesn't have the given edge", %{call_graph: call_graph} do
      refute has_edge?(call_graph, :vertex_1, :vertex_2)
    end
  end

  describe "has_vertex?/2" do
    test "has the given vertex", %{call_graph: call_graph} do
      add_vertex(call_graph, :vertex)
      assert has_vertex?(call_graph, :vertex)
    end

    test "doesn't have the given vertex", %{call_graph: call_graph} do
      refute has_vertex?(call_graph, :vertex)
    end
  end

  test "inbound_remote_edges/2", %{call_graph: call_graph} do
    call_graph
    |> add_edge({:module_1, :fun_a, :arity_a}, {:module_2, :fun_b, :arity_b})
    |> add_edge({:module_3, :fun_c, :arity_c}, {:module_2, :fun_d, :arity_d})
    |> add_edge({:module_4, :fun_e, :arity_e}, :module_2)
    |> add_edge({:module_5, :fun_f, :arity_f}, :module_2)
    |> add_edge({:module_6, :fun_g, :arity_g}, {:module_7, :fun_h, :arity_h})
    |> add_edge({:module_8, :fun_i, :arity_i}, :module_9)

    result =
      call_graph
      |> inbound_remote_edges(:module_2)
      |> Enum.sort()

    assert result == [
             %Graph.Edge{
               v1: {:module_1, :fun_a, :arity_a},
               v2: {:module_2, :fun_b, :arity_b},
               weight: 1,
               label: nil
             },
             %Graph.Edge{
               v1: {:module_3, :fun_c, :arity_c},
               v2: {:module_2, :fun_d, :arity_d},
               weight: 1,
               label: nil
             },
             %Graph.Edge{
               v1: {:module_4, :fun_e, :arity_e},
               v2: :module_2,
               weight: 1,
               label: nil
             },
             %Graph.Edge{
               v1: {:module_5, :fun_f, :arity_f},
               v2: :module_2,
               weight: 1,
               label: nil
             }
           ]
  end

  test "load/2", %{call_graph: call_graph} do
    add_edge(call_graph, :vertex_1, :vertex_2)
    dump(call_graph, @dump_path)

    call_graph_2 = start()

    assert load(call_graph_2, @dump_path) == call_graph_2
    assert get_graph(call_graph_2) == get_graph(call_graph)
  end

  describe "maybe_load/2" do
    test "dump file exists" do
      graph = Graph.add_edge(Graph.new(), :vertex_1, :vertex_2)

      data = SerializationUtils.serialize(graph)
      File.write!(@dump_path, data)

      call_graph = start()

      assert maybe_load(call_graph, @dump_path) == call_graph
      assert get_graph(call_graph) == graph
    end

    test "dump file doesn't exist" do
      call_graph = start()

      assert maybe_load(call_graph, @dump_path) == call_graph
      assert get_graph(call_graph) == Graph.new()
    end
  end

  test "module_vertices/2", %{call_graph: call_graph} do
    ir = IR.for_module(Module13)

    call_graph =
      call_graph
      |> add_vertex({:module_1, :fun_a, 1})
      |> add_vertex({:module_3, :fun_b, 2})
      |> build(ir)
      |> add_vertex(:module_4)

    assert module_vertices(call_graph, Module13) == [
             {Module13, :fun_b, 2},
             {Module13, :fun_d, 4},
             {Module13, :fun_e, 2}
           ]
  end

  describe "patch/3" do
    test "adds modules", %{call_graph: call_graph} do
      module_9_ir = IR.for_module(Module9)
      module_10_ir = IR.for_module(Module10)

      ir_plt =
        PLT.start()
        |> PLT.put(Module9, module_9_ir)
        |> PLT.put(Module10, module_10_ir)

      call_graph_2 =
        start()
        |> build(module_9_ir)
        |> build(module_10_ir)

      diff = %{
        added_modules: [Module10, Module9],
        removed_modules: [],
        updated_modules: []
      }

      patch(call_graph, ir_plt, diff)

      assert get_graph(call_graph) == get_graph(call_graph_2)
    end

    test "removes modules", %{call_graph: call_graph} do
      call_graph
      |> add_edge({:module_1, :fun_a, :arity_a}, {:module_2, :fun_b, :arity_b})
      |> add_edge({:module_2, :fun_c, :arity_c}, {:module_3, :fun_d, :arity_d})
      |> add_edge({:module_1, :fun_e, :arity_e}, {:module_3, :fun_f, :arity_f})
      |> add_edge({:module_4, :fun_g, :arity_g}, :module_2)
      |> add_edge({:module_5, :fun_h, :arity_h}, :module_6)

      ir_plt = PLT.start()

      diff = %{
        added_modules: [],
        removed_modules: [:module_2, :module_3],
        updated_modules: []
      }

      patch(call_graph, ir_plt, diff)

      assert sorted_vertices(call_graph) == [
               :module_6,
               {:module_1, :fun_a, :arity_a},
               {:module_1, :fun_e, :arity_e},
               {:module_4, :fun_g, :arity_g},
               {:module_5, :fun_h, :arity_h}
             ]

      assert edges(call_graph) == [
               %Graph.Edge{
                 v1: {:module_5, :fun_h, :arity_h},
                 v2: :module_6,
                 weight: 1,
                 label: nil
               }
             ]
    end

    test "updates modules", %{call_graph: call_graph} do
      module_9_ir = IR.for_module(Module9)
      module_10_ir = IR.for_module(Module10)

      ir_plt =
        PLT.start()
        |> PLT.put(Module9, module_9_ir)
        |> PLT.put(Module10, module_10_ir)

      call_graph
      |> add_edge({:module_3, :fun_c, :arity_c}, Module9)
      |> add_edge({:module_1, :fun_a, :arity_a}, {Module9, :my_fun_1, 0})
      |> add_edge({:module_2, :fun_b, :arity_b}, {Module9, :my_fun_2, 0})
      |> add_edge({:module_1, :fun_d, :arity_d}, Module9)
      |> add_edge({Module9, :my_fun_3, 2}, {:module_4, :fun_e, :arity_e})
      |> add_edge({Module10, :my_fun_4, 2}, {:module_5, :fun_f, :arity_f})

      diff = %{
        added_modules: [],
        removed_modules: [],
        updated_modules: [Module9, Module10]
      }

      patch(call_graph, ir_plt, diff)

      assert sorted_vertices(call_graph) == [
               Module9,
               {Module10, :my_fun_3, 0},
               {Module10, :my_fun_4, 0},
               {Module9, :my_fun_1, 0},
               {Module9, :my_fun_2, 0},
               {:module_1, :fun_a, :arity_a},
               {:module_1, :fun_d, :arity_d},
               {:module_2, :fun_b, :arity_b},
               {:module_3, :fun_c, :arity_c},
               {:module_4, :fun_e, :arity_e},
               {:module_5, :fun_f, :arity_f}
             ]

      assert sorted_edges(call_graph) == [
               %Graph.Edge{
                 v1: {Module10, :my_fun_3, 0},
                 v2: {Module10, :my_fun_4, 0},
                 weight: 1,
                 label: nil
               },
               %Graph.Edge{
                 v1: {Module9, :my_fun_1, 0},
                 v2: {Module9, :my_fun_2, 0},
                 weight: 1,
                 label: nil
               },
               %Graph.Edge{
                 v1: {:module_1, :fun_a, :arity_a},
                 v2: {Module9, :my_fun_1, 0},
                 weight: 1,
                 label: nil
               },
               %Graph.Edge{
                 v1: {:module_1, :fun_d, :arity_d},
                 v2: Module9,
                 weight: 1,
                 label: nil
               },
               %Graph.Edge{
                 v1: {:module_2, :fun_b, :arity_b},
                 v2: {Module9, :my_fun_2, 0},
                 weight: 1,
                 label: nil
               },
               %Graph.Edge{
                 v1: {:module_3, :fun_c, :arity_c},
                 v2: Module9,
                 weight: 1,
                 label: nil
               }
             ]
    end
  end

  test "put_graph", %{call_graph: call_graph} do
    graph = Graph.add_edge(Graph.new(), :vertex_3, :vertex_4)

    assert put_graph(call_graph, graph) == call_graph
    assert get_graph(call_graph) == graph
  end

  describe "reachable/2" do
    setup %{call_graph: call_graph} do
      # 1
      # ├─ 2
      # │  ├─ 4
      # │  │  ├─ 8
      # │  │  ├─ 9
      # │  ├─ 5
      # │  │  ├─ 10
      # │  │  ├─ 11
      # ├─ 3
      # │  ├─ 6
      # │  │  ├─ 12
      # │  │  ├─ 13
      # │  ├─ 7
      # │  │  ├─ 14
      # │  │  ├─ 15

      call_graph
      |> add_edge(:vertex_1, :vertex_2)
      |> add_edge(:vertex_1, :vertex_3)
      |> add_edge(:vertex_2, :vertex_4)
      |> add_edge(:vertex_2, :vertex_5)
      |> add_edge(:vertex_3, :vertex_6)
      |> add_edge(:vertex_3, :vertex_7)
      |> add_edge(:vertex_4, :vertex_8)
      |> add_edge(:vertex_4, :vertex_9)
      |> add_edge(:vertex_5, :vertex_10)
      |> add_edge(:vertex_5, :vertex_11)
      |> add_edge(:vertex_6, :vertex_12)
      |> add_edge(:vertex_6, :vertex_13)
      |> add_edge(:vertex_7, :vertex_14)
      |> add_edge(:vertex_7, :vertex_15)

      :ok
    end

    test "single vertex argument", %{call_graph: call_graph} do
      assert reachable(call_graph, :vertex_3) == [
               :vertex_15,
               :vertex_14,
               :vertex_7,
               :vertex_13,
               :vertex_12,
               :vertex_6,
               :vertex_3
             ]
    end

    test "multiple vertices argument", %{call_graph: call_graph} do
      assert reachable(call_graph, [:vertex_3, :vertex_5]) == [
               :vertex_11,
               :vertex_10,
               :vertex_5,
               :vertex_15,
               :vertex_14,
               :vertex_7,
               :vertex_13,
               :vertex_12,
               :vertex_6,
               :vertex_3
             ]
    end

    test "vertex that is not in the call graph", %{call_graph: call_graph} do
      assert reachable(call_graph, :not_in_call_graph) == []
    end

    test "vertices that are not in the call graph", %{call_graph: call_graph} do
      assert reachable(call_graph, [:not_in_call_graph_1, :not_in_call_graph_2]) == []
    end
  end

  describe "reachable_mfas/2" do
    setup %{call_graph: call_graph} do
      # 1
      # ├─ {:m2, :f2, 2}
      # │  ├─ 4
      # │  │  ├─ {:m8, :f8, 8}
      # │  │  ├─ 9
      # │  ├─ {:m5, :f5, 5}
      # │  │  ├─ 10
      # │  │  ├─ 11
      # ├─ {:m3, :f3, 3}
      # │  ├─ 6
      # │  │  ├─ {:m12, :f12, 12}
      # │  │  ├─ 13
      # │  ├─ {:m7, :f7, 7}
      # │  │  ├─ 14
      # │  │  ├─ {:m15, :f15, 15}

      call_graph
      |> add_edge(:vertex_1, {:m2, :f2, 2})
      |> add_edge(:vertex_1, {:m3, :f3, 3})
      |> add_edge({:m2, :f2, 2}, :vertex_4)
      |> add_edge({:m2, :f2, 2}, {:m5, :f5, 5})
      |> add_edge({:m3, :f3, 3}, :vertex_6)
      |> add_edge({:m3, :f3, 3}, {:m7, :f7, 7})
      |> add_edge(:vertex_4, {:m8, :f8, 8})
      |> add_edge(:vertex_4, :vertex_9)
      |> add_edge({:m5, :f5, 5}, :vertex_10)
      |> add_edge({:m5, :f5, 5}, :vertex_11)
      |> add_edge(:vertex_6, {:m12, :f12, 12})
      |> add_edge(:vertex_6, :vertex_13)
      |> add_edge({:m7, :f7, 7}, :vertex_14)
      |> add_edge({:m7, :f7, 7}, {:m15, :f15, 15})

      :ok
    end

    test "single MFA argument", %{call_graph: call_graph} do
      assert reachable_mfas(call_graph, {:m3, :f3, 3}) == [
               {:m15, :f15, 15},
               {:m7, :f7, 7},
               {:m12, :f12, 12},
               {:m3, :f3, 3}
             ]
    end

    test "multiple MFAs argument", %{call_graph: call_graph} do
      assert reachable_mfas(call_graph, [{:m5, :f5, 5}, {:m3, :f3, 3}]) == [
               {:m15, :f15, 15},
               {:m7, :f7, 7},
               {:m12, :f12, 12},
               {:m3, :f3, 3},
               {:m5, :f5, 5}
             ]
    end
  end

  test "remove_vertex/2", %{call_graph: call_graph} do
    call_graph
    |> add_vertex(:vertex_1)
    |> add_vertex(:vertex_2)
    |> add_vertex(:vertex_3)
    |> add_edge(:vertex_1, :vertex_2)
    |> add_edge(:vertex_2, :vertex_3)
    |> add_edge(:vertex_3, :vertex_1)
    |> remove_vertex(:vertex_2)

    assert has_vertex?(call_graph, :vertex_1)
    refute has_vertex?(call_graph, :vertex_2)
    assert has_vertex?(call_graph, :vertex_3)

    refute has_edge?(call_graph, :vertex_1, :vertex_2)
    refute has_edge?(call_graph, :vertex_2, :vertex_3)
    assert has_edge?(call_graph, :vertex_3, :vertex_1)
  end

  test "remove_vertices/2", %{call_graph: call_graph} do
    call_graph
    |> add_vertex(:vertex_1)
    |> add_vertex(:vertex_2)
    |> add_vertex(:vertex_3)
    |> add_vertex(:vertex_4)
    |> add_edge(:vertex_1, :vertex_2)
    |> add_edge(:vertex_2, :vertex_3)
    |> add_edge(:vertex_3, :vertex_4)
    |> add_edge(:vertex_4, :vertex_1)
    |> remove_vertices([:vertex_2, :vertex_3])

    assert has_vertex?(call_graph, :vertex_1)
    refute has_vertex?(call_graph, :vertex_2)
    refute has_vertex?(call_graph, :vertex_3)
    assert has_vertex?(call_graph, :vertex_4)

    refute has_edge?(call_graph, :vertex_1, :vertex_2)
    refute has_edge?(call_graph, :vertex_2, :vertex_3)
    refute has_edge?(call_graph, :vertex_3, :vertex_4)
    assert has_edge?(call_graph, :vertex_4, :vertex_1)
  end

  test "sorted_edges/1", %{call_graph: call_graph} do
    call_graph
    |> add_edge(:vertex_4, :vertex_5)
    |> add_vertex(:vertex_1)
    |> add_edge(:vertex_2, :vertex_3)

    assert sorted_edges(call_graph) == [
             %Graph.Edge{v1: :vertex_2, v2: :vertex_3, weight: 1, label: nil},
             %Graph.Edge{v1: :vertex_4, v2: :vertex_5, weight: 1, label: nil}
           ]
  end

  test "sorted_vertices/1", %{call_graph: call_graph} do
    call_graph
    |> add_edge(:vertex_4, :vertex_5)
    |> add_vertex(:vertex_1)
    |> add_edge(:vertex_2, :vertex_3)

    assert sorted_vertices(call_graph) == [:vertex_1, :vertex_2, :vertex_3, :vertex_4, :vertex_5]
  end

  test "start/0" do
    assert %CallGraph{pid: pid} = start()

    assert is_pid(pid)
    assert Agent.get(pid, & &1) == Graph.new()
  end

  test "vertices/1", %{call_graph: call_graph} do
    call_graph
    |> add_edge(:vertex_4, :vertex_5)
    |> add_vertex(:vertex_1)
    |> add_edge(:vertex_2, :vertex_3)

    result = vertices(call_graph)

    assert Enum.count(result) == 5
    assert :vertex_1 in result
    assert :vertex_2 in result
    assert :vertex_3 in result
    assert :vertex_4 in result
    assert :vertex_5 in result
  end
end
