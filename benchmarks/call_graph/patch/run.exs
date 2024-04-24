alias Hologram.Benchmarks
alias Hologram.Commons.Reflection
alias Hologram.Compiler
alias Hologram.Compiler.CallGraph

Benchee.run(
  %{
    "no module changes" => {
      fn {call_graph, ir_plt, diff} ->
        CallGraph.patch(call_graph, ir_plt, diff)
      end,
      before_scenario: fn {modules, ir_plt} ->
        {old_module_digest_plt, new_module_digest_plt} =
          Benchmarks.generate_module_digest_plts(0, 0, 0)

        diff = Compiler.diff_module_digest_plts(old_module_digest_plt, new_module_digest_plt)

        {modules, ir_plt, diff}
      end
    },
    "1 module added " => {
      fn {call_graph, ir_plt, diff} ->
        CallGraph.patch(call_graph, ir_plt, diff)
      end,
      before_scenario: fn {modules, ir_plt} ->
        diff = %{
          added_modules: Enum.take(modules, 1),
          removed_modules: [],
          updated_modules: []
        }

        {modules, ir_plt, diff}
      end
    },
    "1 module removed " => {
      fn {call_graph, ir_plt, diff} ->
        CallGraph.patch(call_graph, ir_plt, diff)
      end,
      before_scenario: fn {modules, ir_plt} ->
        diff = %{
          added_modules: [],
          removed_modules: Enum.take(modules, 1),
          updated_modules: []
        }

        {modules, ir_plt, diff}
      end
    },
    "1 module updated " => {
      fn {call_graph, ir_plt, diff} ->
        CallGraph.patch(call_graph, ir_plt, diff)
      end,
      before_scenario: fn {modules, ir_plt} ->
        diff = %{
          added_modules: [],
          removed_modules: [],
          updated_modules: Enum.take(modules, 1)
        }

        {modules, ir_plt, diff}
      end
    },
    "100% modules added" => {
      fn {call_graph, ir_plt, diff} ->
        CallGraph.patch(call_graph, ir_plt, diff)
      end,
      before_scenario: fn {modules, ir_plt} ->
        {old_module_digest_plt, new_module_digest_plt} =
          Benchmarks.generate_module_digest_plts(100, 0, 0)

        diff = Compiler.diff_module_digest_plts(old_module_digest_plt, new_module_digest_plt)

        {modules, ir_plt, diff}
      end
    },
    "100% modules removed" => {
      fn {call_graph, ir_plt, diff} ->
        CallGraph.patch(call_graph, ir_plt, diff)
      end,
      before_scenario: fn {modules, ir_plt} ->
        {old_module_digest_plt, new_module_digest_plt} =
          Benchmarks.generate_module_digest_plts(0, 100, 0)

        diff = Compiler.diff_module_digest_plts(old_module_digest_plt, new_module_digest_plt)

        {modules, ir_plt, diff}
      end
    },
    "100% modules updated" => {
      fn {call_graph, ir_plt, diff} ->
        CallGraph.patch(call_graph, ir_plt, diff)
      end,
      before_scenario: fn {modules, ir_plt} ->
        {old_module_digest_plt, new_module_digest_plt} =
          Benchmarks.generate_module_digest_plts(0, 0, 100)

        diff = Compiler.diff_module_digest_plts(old_module_digest_plt, new_module_digest_plt)

        {modules, ir_plt, diff}
      end
    },
    "33% added, 33% removed, 34% updated" => {
      fn {call_graph, ir_plt, diff} ->
        CallGraph.patch(call_graph, ir_plt, diff)
      end,
      before_scenario: fn {modules, ir_plt} ->
        {old_module_digest_plt, new_module_digest_plt} =
          Benchmarks.generate_module_digest_plts(33, 33, 34)

        diff = Compiler.diff_module_digest_plts(old_module_digest_plt, new_module_digest_plt)

        {modules, ir_plt, diff}
      end
    },
    "1% added, 1% removed, 1% updated" => {
      fn {call_graph, ir_plt, diff} ->
        CallGraph.patch(call_graph, ir_plt, diff)
      end,
      before_scenario: fn {modules, ir_plt} ->
        {old_module_digest_plt, new_module_digest_plt} =
          Benchmarks.generate_module_digest_plts(1, 1, 1)

        diff = Compiler.diff_module_digest_plts(old_module_digest_plt, new_module_digest_plt)

        {modules, ir_plt, diff}
      end
    },
    "10 added, 10 removed, 10 updated" => {
      fn {call_graph, ir_plt, diff} ->
        CallGraph.patch(call_graph, ir_plt, diff)
      end,
      before_scenario: fn {modules, ir_plt} ->
        diff = %{
          added_modules: Enum.take(modules, 10),
          removed_modules: Enum.drop(Enum.take(modules, 20), 10),
          updated_modules: Enum.take(modules, -10)
        }

        {modules, ir_plt, diff}
      end
    },
    "3 added, 3 removed, 3 updated" => {
      fn {call_graph, ir_plt, diff} ->
        CallGraph.patch(call_graph, ir_plt, diff)
      end,
      before_scenario: fn {modules, ir_plt} ->
        diff = %{
          added_modules: Enum.take(modules, 3),
          removed_modules: Enum.drop(Enum.take(modules, 6), 3),
          updated_modules: Enum.take(modules, -3)
        }

        {modules, ir_plt, diff}
      end
    },
    "1 added, 1 removed, 1 updated" => {
      fn {call_graph, ir_plt, diff} ->
        CallGraph.patch(call_graph, ir_plt, diff)
      end,
      before_scenario: fn {modules, ir_plt} ->
        diff = %{
          added_modules: Enum.take(modules, 1),
          removed_modules: Enum.drop(Enum.take(modules, 2), 1),
          updated_modules: Enum.take(modules, -1)
        }

        {modules, ir_plt, diff}
      end
    }
  },
  before_scenario: fn _input ->
    module_beam_path_plt = Compiler.build_module_beam_path_plt()
    ir_plt = Compiler.build_ir_plt(module_beam_path_plt)
    modules = Reflection.list_elixir_modules()

    {modules, ir_plt}
  end,
  before_each: fn {modules, ir_plt, diff} ->
    call_graph = CallGraph.start()
    call_graph_modules = modules -- diff.added_modules

    Enum.each(call_graph_modules, &CallGraph.build_for_module(call_graph, ir_plt, &1))

    {call_graph, ir_plt, diff}
  end,
  after_each: fn call_graph ->
    CallGraph.stop(call_graph)
  end,
  formatters: [
    Benchee.Formatters.Console,
    {Benchee.Formatters.Markdown,
     description: "diff_module_digest_plts/2", file: Path.join(__DIR__, "README.md")}
  ],
  time: 60
)
