defmodule Hologram.Compiler.MapTypeTransformerTest do
  use Hologram.TestCase, async: true

  alias Hologram.Compiler.IR.{AtomType, IntegerType, MapType}
  alias Hologram.Compiler.MapTypeTransformer

  setup do
    [
      module: [:Abc],
      imports: [],
      aliases: []
    ]
  end

  test "empty map", context do
    code = "%{}"
    {:%{}, _, ast} = ast(code)

    result = MapTypeTransformer.transform(ast, context)
    expected = %MapType{data: []}

    assert result == expected
  end

  test "non-nested map", context do
    code = "%{a: 1, b: 2}"
    {:%{}, _, ast} = ast(code)

    result = MapTypeTransformer.transform(ast, context)

    expected = %MapType{
      data: [
        {%AtomType{value: :a}, %IntegerType{value: 1}},
        {%AtomType{value: :b}, %IntegerType{value: 2}}
      ]
    }

    assert result == expected
  end

  test "nested map", context do
    code = "%{a: 1, b: %{c: 2, d: %{e: 3, f: 4}}}"
    {:%{}, _, ast} = ast(code)

    result = MapTypeTransformer.transform(ast, context)

    expected = %MapType{
      data: [
        {%AtomType{value: :a}, %IntegerType{value: 1}},
        {%AtomType{value: :b},
         %MapType{
           data: [
             {%AtomType{value: :c}, %IntegerType{value: 2}},
             {%AtomType{value: :d},
              %MapType{
                data: [
                  {%AtomType{value: :e}, %IntegerType{value: 3}},
                  {%AtomType{value: :f}, %IntegerType{value: 4}}
                ]
              }}
           ]
         }}
      ]
    }

    assert result == expected
  end
end
