# TODO: refactor & test

defmodule Hologram.Transpiler.Transformer do
  alias Hologram.Transpiler.AST.{AtomType, BooleanType, IntegerType, MatchOperator, StringType}
  alias Hologram.Transpiler.AST.{Alias, Import, ModuleAttribute, Variable}
  alias Hologram.Transpiler.Binder
  alias Hologram.Transpiler.{AdditionOperatorTransformer, AliasTransformer, DotOperatorTransformer, FunctionTransformer, FunctionCallTransformer, ListTypeTransformer, MapTypeTransformer, ModuleTransformer, StructTypeTransformer}

  def transform(ast, context \\ [module: [], imports: [], aliases: []])

  # TYPES

  # boolean must be before atom
  def transform(ast, _) when is_boolean(ast) do
    %BooleanType{value: ast}
  end

  def transform(ast, _) when is_atom(ast) do
    %AtomType{value: ast}
  end

  def transform(ast, _) when is_integer(ast) do
    %IntegerType{value: ast}
  end

  def transform(ast, _) when is_binary(ast) do
    %StringType{value: ast}
  end

  def transform(ast, context) when is_list(ast) do
    ListTypeTransformer.transform(ast, context)
  end

  def transform({:%{}, _, ast}, context) do
    MapTypeTransformer.transform(ast, context)
  end

  def transform({:%, _, [{_, _, module}, ast]}, context) do
    StructTypeTransformer.transform(ast, module, context)
  end

  # OPERATORS

  def transform({:+, _, [left, right]}, context) do
    AdditionOperatorTransformer.transform(left, right, context)
  end

  def transform({{:., _, [left, right]}, [no_parens: true, line: _], []}, context) do
    DotOperatorTransformer.transform(left, right, context)
  end

  def transform({:=, _, [left, right]}, context) do
    left = transform(left, context)

    %MatchOperator{
      bindings: Binder.bind(left),
      left: left,
      right: transform(right, context)
    }
  end

  def transform({:@, _, [{name, _, _}]}, _) do
    %ModuleAttribute{name: name}
  end

  # DIRECTIVES

  def transform({:alias, _, ast}, _) do
    AliasTransformer.transform(ast)
  end

  def transform({:import, _, [{:__aliases__, _, module}]}, _) do
    %Import{module: module}
  end

  # OTHER

  def transform({:defmodule, _, [_, [do: {:__block__, _, _}]]} = ast, _) do
    ModuleTransformer.transform(ast)
  end

  def transform({:def, _, [{name, _, params}, [do: {:__block__, _, body}]]}, context) do
    FunctionTransformer.transform(name, params, body, context)
  end

  def transform({name, _, nil}, _) when is_atom(name) do
    %Variable{name: name}
  end

  def transform({function, _, params}, context) when is_atom(function) do
    FunctionCallTransformer.transform([], function, params, context)
  end

  def transform({{:., _, [{:__aliases__, _, module}, function]}, _, params}, context) do
    FunctionCallTransformer.transform(module, function, params, context)
  end
end
