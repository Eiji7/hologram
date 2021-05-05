defmodule Hologram.Compiler.StructTypeGeneratorTest do
  use ExUnit.Case, async: true

  alias Hologram.Compiler.AST.{AtomType, IntegerType, StructType}
  alias Hologram.Compiler.StructTypeGenerator

  test "generate/3", context do
    data = [{%AtomType{value: :a}, %IntegerType{value: 1}}]
    module = [:Abc, :Bcd]

    result = StructTypeGenerator.generate(module, data, [])

    expected =
      "{ type: 'struct', module: 'Abc.Bcd', data: { '~atom[a]': { type: 'integer', value: 1 } } }"

    assert result == expected
  end
end
