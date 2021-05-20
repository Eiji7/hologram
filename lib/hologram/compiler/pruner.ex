defmodule Hologram.Compiler.Pruner do
  alias Hologram.Compiler.IR.{FunctionCall, FunctionDefinition, ModuleDefinition}

  @doc """
  Prunes unused modules and functions.
  """
  def prune(compiled_modules, main_module) do
    aggregate_used_functions(main_module, compiled_modules)
    |> prune_unused_functions(compiled_modules)
    |> prune_unused_modules()
  end

  defp aggregate_used_functions(main_module, compiled_modules) do
    spec = {main_module, :action, 3}
    acc = MapSet.new([spec])

    get_functions(compiled_modules, spec)
    |> Enum.reduce(acc, &recurse(&2, compiled_modules, &1))
  end

  defp get_functions(compiled_modules, {module, function, arity}) do
    case compiled_modules[module] do
      # Elixir standar library
      nil ->
        []

      %{functions: functions} ->
        Enum.filter(functions, &(&1.name == function && &1.arity == arity))
    end
  end

  defp handle_expr(acc, compiled_modules, %FunctionCall{module: module, function: function, params: params}) do
    spec = {module, function, Enum.count(params)}

    if spec not in acc do
      acc = MapSet.put(acc, spec)

      functions = get_functions(compiled_modules, spec)
      |> Enum.reduce(acc, &recurse(&2, compiled_modules, &1))
    else
      acc
    end
  end

  defp handle_expr(acc, _, _) do
    acc
  end

  defp prune_unused_functions(used_functions, compiled_modules) do
    Enum.map(compiled_modules, fn {module_name, module} ->
      preserved_functions =
        Enum.reduce(module.functions, [], fn function, acc ->
          if {module_name, function.name, function.arity} in used_functions do
            acc ++ [function]
          else
            acc
          end
        end)

      {module_name, %{module | functions: preserved_functions}}
    end)
    |> Enum.into(%{})
  end

  defp prune_unused_modules(compiled_modules) do
    Enum.filter(compiled_modules, fn {_, module} ->
      Enum.any?(module.functions)
    end)
    |> Enum.into(%{})
  end

  # TODO: support function calls nested in blocks
  defp recurse(acc, compiled_modules, %FunctionDefinition{body: body}) do
    Enum.reduce(body, acc, &handle_expr(&2, compiled_modules, &1))
  end
end
