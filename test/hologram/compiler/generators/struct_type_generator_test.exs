defmodule Hologram.Compiler.StructTypeGeneratorTest do
  use Hologram.TestCase, async: true

  alias Hologram.Compiler.IR.{AtomType, IntegerType}
  alias Hologram.Compiler.StructTypeGenerator

  test "generate/4" do
    data = [{%AtomType{value: :a}, %IntegerType{value: 1}}]
    module = [:Abc, :Bcd]

    result = StructTypeGenerator.generate(module, data, [], [])

    expected =
      "{ type: 'struct', module: 'Abc.Bcd', data: { '~atom[a]': { type: 'integer', value: 1 } } }"

    assert result == expected
  end
end
