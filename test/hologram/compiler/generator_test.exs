# TODO: refactor

defmodule Hologram.Compiler.GeneratorTest do
  use ExUnit.Case, async: true

  alias Hologram.Compiler.AST.{AtomType, BooleanType, IntegerType, StringType}
  alias Hologram.Compiler.AST.{MapType, StructType}
  alias Hologram.Compiler.AST.{FunctionCall, Variable}
  alias Hologram.Compiler.Generator

  describe "types" do
    test "atom" do
      result = Generator.generate(%AtomType{value: :test})
      assert result == "{ type: 'atom', value: 'test' }"
    end

    test "boolean" do
      result = Generator.generate(%BooleanType{value: true})
      assert result == "{ type: 'boolean', value: true }"
    end

    test "integer" do
      result = Generator.generate(%IntegerType{value: 123})
      assert result == "{ type: 'integer', value: 123 }"
    end

    test "map" do
      ast = %MapType{data: [{%AtomType{value: :a}, %IntegerType{value: 1}}]}

      result = Generator.generate(ast)

      expected =
        "{ type: 'map', data: { '~atom[a]': { type: 'integer', value: 1 } } }"

      assert result == expected
    end

    test "string" do
      result = Generator.generate(%StringType{value: "Test"})
      assert result == "{ type: 'string', value: 'Test' }"
    end

    test "struct" do
      ast = %StructType{
        data: [{%AtomType{value: :a}, %IntegerType{value: 1}}],
        module: [:Abc, :Bcd]
      }

      result = Generator.generate(ast)

      expected =
        "{ type: 'struct', module: 'Abc.Bcd', data: { '~atom[a]': { type: 'integer', value: 1 } } }"

      assert result == expected
    end
  end

  describe "other" do
    test "variable, not boxed" do
      result = Generator.generate(%Variable{name: :test})
      expected = "test"
      assert result == expected
    end

    test "variable, boxed" do
      result = Generator.generate(%Variable{name: :test}, [], boxed: true)
      expected = "{ type: 'variable', name: 'test' }"

      assert result == expected
    end

    test "function call with params" do
      ast = %FunctionCall{
        module: [:Abc, :Bcd],
        function: :test,
        params: [
          %IntegerType{value: 1},
          %Variable{name: :xyz}
        ]
      }

      result = Generator.generate(ast)
      expected = "AbcBcd.test({ type: 'integer', value: 1 }, xyz)"

      assert result == expected
    end

    test "function call without params" do
      ast = %FunctionCall{
        module: [:Abc, :Bcd],
        function: :test,
        params: []
      }

      result = Generator.generate(ast)
      expected = "AbcBcd.test()"

      assert result == expected
    end
  end
end
