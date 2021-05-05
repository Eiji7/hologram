defmodule Hologram.Compiler.ModuleAttributeOperatorGeneratorTest do
  use ExUnit.Case, async: true
  alias Hologram.Compiler.ModuleAttributeOperatorGenerator

  test "generate/2" do
    result = ModuleAttributeOperatorGenerator.generate(:xyz, [])
    expected = "$state.data['~atom[xyz]']"

    assert result == expected
  end
end
