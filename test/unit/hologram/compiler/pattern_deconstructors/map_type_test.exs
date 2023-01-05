defmodule Hologram.Compiler.PatternDeconstructor.MapTypeTest do
  use Hologram.Test.UnitCase, async: false

  alias Hologram.Compiler.IR.AtomType
  alias Hologram.Compiler.IR.IntegerType
  alias Hologram.Compiler.IR.MapAccess
  alias Hologram.Compiler.IR.MapType
  alias Hologram.Compiler.IR.Symbol
  alias Hologram.Compiler.PatternDeconstructor

  test "non-nested map without vars" do
    ir = %MapType{
      data: [
        {%AtomType{value: :a}, %IntegerType{value: 1}},
        {%AtomType{value: :b}, %IntegerType{value: 2}}
      ]
    }

    assert PatternDeconstructor.deconstruct(ir) == []
  end

  test "non-nested map with single var" do
    ir = %MapType{
      data: [
        {%AtomType{value: :a}, %IntegerType{value: 1}},
        {%AtomType{value: :b}, %Symbol{name: :x}}
      ]
    }

    result = PatternDeconstructor.deconstruct(ir)

    expected = [
      [
        %MapAccess{
          key: %AtomType{value: :b}
        },
        %Symbol{name: :x}
      ]
    ]

    assert result == expected
  end

  test "non-nested map with multiple vars" do
    ir = %MapType{
      data: [
        {%AtomType{value: :a}, %Symbol{name: :x}},
        {%AtomType{value: :b}, %IntegerType{value: 2}},
        {%AtomType{value: :c}, %Symbol{name: :y}}
      ]
    }

    result = PatternDeconstructor.deconstruct(ir)

    expected = [
      [
        %MapAccess{
          key: %AtomType{value: :a}
        },
        %Symbol{name: :x}
      ],
      [
        %MapAccess{
          key: %AtomType{value: :c}
        },
        %Symbol{name: :y}
      ]
    ]

    assert result == expected
  end

  test "nested map without vars" do
    ir = %MapType{
      data: [
        {%AtomType{value: :a}, %IntegerType{value: 1}},
        {%AtomType{value: :b},
         %MapType{
           data: [
             {%AtomType{value: :c}, %IntegerType{value: 3}},
             {%AtomType{value: :d}, %IntegerType{value: 4}}
           ]
         }}
      ]
    }

    assert PatternDeconstructor.deconstruct(ir) == []
  end

  test "nested map with single var" do
    ir = %MapType{
      data: [
        {%AtomType{value: :a}, %IntegerType{value: 1}},
        {%AtomType{value: :b},
         %MapType{
           data: [
             {%AtomType{value: :c}, %Symbol{name: :x}},
             {%AtomType{value: :d}, %IntegerType{value: 4}}
           ]
         }}
      ]
    }

    result = PatternDeconstructor.deconstruct(ir)

    expected = [
      [
        %MapAccess{
          key: %AtomType{value: :b}
        },
        %MapAccess{
          key: %AtomType{value: :c}
        },
        %Symbol{name: :x}
      ]
    ]

    assert result == expected
  end

  test "nested map with multiple vars" do
    ir = %MapType{
      data: [
        {%AtomType{value: :a}, %IntegerType{value: 1}},
        {%AtomType{value: :b}, %Symbol{name: :x}},
        {%AtomType{value: :c},
         %MapType{
           data: [
             {%AtomType{value: :d}, %Symbol{name: :y}},
             {%AtomType{value: :e}, %IntegerType{value: 4}}
           ]
         }}
      ]
    }

    result = PatternDeconstructor.deconstruct(ir)

    expected = [
      [
        %MapAccess{
          key: %AtomType{value: :b}
        },
        %Symbol{name: :x}
      ],
      [
        %MapAccess{
          key: %AtomType{value: :c}
        },
        %MapAccess{
          key: %AtomType{value: :d}
        },
        %Symbol{name: :y}
      ]
    ]

    assert result == expected
  end
end
