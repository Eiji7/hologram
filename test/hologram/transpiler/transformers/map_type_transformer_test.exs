defmodule Hologram.Transpiler.MapTypeTransformerTest do
  use ExUnit.Case, async: true

  alias Hologram.Transpiler.AST.{AtomType, IntegerType, MapType}
  alias Hologram.Transpiler.MapTypeTransformer

  setup do
    [
      module: [:Abc],
      imports: [],
      aliases: []
    ]
  end

  test "empty map", context do
    result = MapTypeTransformer.transform([], context)
    expected = %MapType{data: []}

    assert result == expected
  end

  test "non-nested map", context do
    result = MapTypeTransformer.transform([a: 1, b: 2], context)

    expected = %MapType{
      data: [
        {%AtomType{value: :a}, %IntegerType{value: 1}},
        {%AtomType{value: :b}, %IntegerType{value: 2}}
      ]
    }

    assert result == expected
  end

  test "nested map", context do
    ast = [
      a: 1,
      b: {:%{}, [line: 1], [
        c: 2,
        d: {:%{}, [line: 1], [
          e: 3,
          f: 4
        ]}
      ]}
    ]

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
