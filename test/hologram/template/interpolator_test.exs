defmodule Hologram.Template.InterpolatorTest do
  use Hologram.TestCase, async: true

  alias Hologram.Compiler.IR.ModuleAttributeOperator
  alias Hologram.Template.VirtualDOM.{Expression, ElementNode, TextNode}
  alias Hologram.Template.Interpolator

  test "text" do
    nodes = [
      %TextNode{text: "test"}
    ]

    result = Interpolator.interpolate(nodes)
    assert result == nodes
  end

  test "expression" do
    nodes = [
      %TextNode{text: "{{ @abc }}"}
    ]

    result = Interpolator.interpolate(nodes)

    expected = [
      %Expression{
        ir: %ModuleAttributeOperator{name: :abc}
      }
    ]

    assert result == expected
  end

  test "text, expression" do
    nodes = [
      %TextNode{text: "bcd{{ @abc }}"}
    ]

    result = Interpolator.interpolate(nodes)

    expected = [
      %TextNode{text: "bcd"},
      %Expression{
        ir: %ModuleAttributeOperator{name: :abc}
      }
    ]

    assert result == expected
  end

  test "expression, text" do
    nodes = [
      %TextNode{text: "{{ @abc }}bcd"}
    ]

    result = Interpolator.interpolate(nodes)

    expected = [
      %Expression{
        ir: %ModuleAttributeOperator{name: :abc}
      },
      %TextNode{text: "bcd"}
    ]

    assert result == expected
  end

  test "expression, expression" do
    nodes = [
      %TextNode{text: "{{ @abc }}{{ @bcd }}"}
    ]

    result = Interpolator.interpolate(nodes)

    expected = [
      %Expression{
        ir: %ModuleAttributeOperator{name: :abc}
      },
      %Expression{
        ir: %ModuleAttributeOperator{name: :bcd}
      }
    ]

    assert result == expected
  end

  test "text, expression, text" do
    nodes = [
      %TextNode{text: "cde{{ @abc }}bcd"}
    ]

    result = Interpolator.interpolate(nodes)

    expected = [
      %TextNode{text: "cde"},
      %Expression{
        ir: %ModuleAttributeOperator{name: :abc}
      },
      %TextNode{text: "bcd"}
    ]

    assert result == expected
  end

  test "expression, text, expression" do
    nodes = [
      %TextNode{text: "{{ @abc }}bcd{{ @cde }}"}
    ]

    result = Interpolator.interpolate(nodes)

    expected = [
      %Expression{
        ir: %ModuleAttributeOperator{name: :abc}
      },
      %TextNode{text: "bcd"},
      %Expression{
        ir: %ModuleAttributeOperator{name: :cde}
      }
    ]

    assert result == expected
  end

  test "text, expression, text, expression" do
    nodes = [
      %TextNode{text: "cde{{ @abc }}bcd{{ @def }}"}
    ]

    result = Interpolator.interpolate(nodes)

    expected = [
      %TextNode{text: "cde"},
      %Expression{
        ir: %ModuleAttributeOperator{name: :abc}
      },
      %TextNode{text: "bcd"},
      %Expression{
        ir: %ModuleAttributeOperator{name: :def}
      }
    ]

    assert result == expected
  end

  test "expression, text, expression, text" do
    nodes = [
      %TextNode{text: "{{ @abc }}bcd{{ @cde }}def"}
    ]

    result = Interpolator.interpolate(nodes)

    expected = [
      %Expression{
        ir: %ModuleAttributeOperator{name: :abc}
      },
      %TextNode{text: "bcd"},
      %Expression{
        ir: %ModuleAttributeOperator{name: :cde}
      },
      %TextNode{text: "def"}
    ]

    assert result == expected
  end

  test "multiple nodes" do
    nodes = [
      %TextNode{text: "test_1"},
      %TextNode{text: "test_2"}
    ]

    result = Interpolator.interpolate(nodes)
    assert result == nodes
  end

  test "nested node" do
    nodes = [
      %TextNode{text: "abc{{ @bcd }}"},
      %ElementNode{
        tag: "div",
        attrs: %{},
        children: [
          %TextNode{text: "cde{{ @def }}"}
        ]
      }
    ]

    result = Interpolator.interpolate(nodes)

    expected = [
      %TextNode{text: "abc"},
      %Expression{
        ir: %ModuleAttributeOperator{name: :bcd}
      },
      %ElementNode{
        attrs: %{},
        children: [
          %TextNode{text: "cde"},
          %Expression{
            ir: %ModuleAttributeOperator{name: :def}
          }
        ],
        tag: "div"
      }
    ]

    assert result == expected
  end
end
