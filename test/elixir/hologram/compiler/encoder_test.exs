defmodule Hologram.Compiler.EncoderTest do
  use Hologram.Test.BasicCase, async: true
  import Hologram.Compiler.Encoder

  alias Hologram.Compiler.Context
  alias Hologram.Compiler.IR

  test "anonymous function call" do
    # my_fun.(1, 2)
    ir = %IR.AnonymousFunctionCall{
      function: %IR.Variable{name: :my_fun},
      args: [
        %IR.IntegerType{value: 1},
        %IR.IntegerType{value: 2}
      ]
    }

    assert encode(ir, %Context{}) ==
             "Interpreter.callAnonymousFunction(vars.my_fun, [Type.integer(1n), Type.integer(2n)])"
  end

  describe "anonymous function type" do
    test "with single clause" do
      # fn x -> :expr end
      ir = %IR.AnonymousFunctionType{
        arity: 1,
        clauses: [
          %IR.FunctionClause{
            params: [%IR.Variable{name: :x}],
            guards: [],
            body: %IR.Block{
              expressions: [%IR.AtomType{value: :expr}]
            }
          }
        ]
      }

      assert encode(ir, %Context{}) == """
             Type.anonymousFunction(1, [{params: (vars) => [Type.variablePattern("x")], guards: [], body: (vars) => {
             return Type.atom("expr");
             }}], vars)\
             """
    end

    test "with multiple clauses" do
      # fn
      #   x -> :expr_a
      #   y -> :expr_b
      # end
      ir = %IR.AnonymousFunctionType{
        arity: 1,
        clauses: [
          %IR.FunctionClause{
            params: [%IR.Variable{name: :x}],
            guards: [],
            body: %IR.Block{
              expressions: [%IR.AtomType{value: :expr_a}]
            }
          },
          %IR.FunctionClause{
            params: [%IR.Variable{name: :y}],
            guards: [],
            body: %IR.Block{
              expressions: [%IR.AtomType{value: :expr_b}]
            }
          }
        ]
      }

      assert encode(ir, %Context{}) == """
             Type.anonymousFunction(1, [{params: (vars) => [Type.variablePattern("x")], guards: [], body: (vars) => {
             return Type.atom("expr_a");
             }}, {params: (vars) => [Type.variablePattern("y")], guards: [], body: (vars) => {
             return Type.atom("expr_b");
             }}], vars)\
             """
    end
  end

  describe "atom type" do
    test "nil" do
      # nil
      ir = %IR.AtomType{value: nil}

      assert encode(ir, %Context{}) == ~s/Type.atom("nil")/
    end

    test "false" do
      # false
      ir = %IR.AtomType{value: false}

      assert encode(ir, %Context{}) == ~s/Type.atom("false")/
    end

    test "true" do
      # true
      ir = %IR.AtomType{value: true}

      assert encode(ir, %Context{}) == ~s/Type.atom("true")/
    end

    test "non-nil and non-boolean" do
      # :"aa\"bb\ncc"
      ir = %IR.AtomType{value: :"aa\"bb\ncc"}

      assert encode(ir, %Context{}) == ~s/Type.atom("aa\\"bb\\ncc")/
    end
  end

  describe "bitstring pattern" do
    @context %Context{pattern?: true}

    test "no segments" do
      # <<>>
      ir = %IR.BitstringType{segments: []}

      assert encode(ir, @context) == "Type.bitstringPattern([])"
    end

    test "single segment" do
      # <<1>>
      ir = %IR.BitstringType{
        segments: [
          %IR.BitstringSegment{
            value: %IR.IntegerType{value: 1},
            modifiers: []
          }
        ]
      }

      assert encode(ir, @context) ==
               "Type.bitstringPattern([Type.bitstringSegment(Type.integer(1n), {})])"
    end

    test "multiple segments" do
      # <<1, 2>>
      ir = %IR.BitstringType{
        segments: [
          %IR.BitstringSegment{
            value: %IR.IntegerType{value: 1},
            modifiers: []
          },
          %IR.BitstringSegment{
            value: %IR.IntegerType{value: 2},
            modifiers: []
          }
        ]
      }

      assert encode(ir, @context) ==
               "Type.bitstringPattern([Type.bitstringSegment(Type.integer(1n), {}), Type.bitstringSegment(Type.integer(2n), {})])"
    end
  end

  describe "bitstring type" do
    @context %Context{pattern?: false}

    test "no segments" do
      # <<>>
      ir = %IR.BitstringType{segments: []}

      assert encode(ir, @context) == "Type.bitstring([])"
    end

    test "single segment" do
      # <<1>>
      ir = %IR.BitstringType{
        segments: [
          %IR.BitstringSegment{
            value: %IR.IntegerType{value: 1},
            modifiers: []
          }
        ]
      }

      assert encode(ir, @context) ==
               "Type.bitstring([Type.bitstringSegment(Type.integer(1n), {})])"
    end

    test "multiple segments" do
      # <<1, 2>>
      ir = %IR.BitstringType{
        segments: [
          %IR.BitstringSegment{
            value: %IR.IntegerType{value: 1},
            modifiers: []
          },
          %IR.BitstringSegment{
            value: %IR.IntegerType{value: 2},
            modifiers: []
          }
        ]
      }

      assert encode(ir, @context) ==
               "Type.bitstring([Type.bitstringSegment(Type.integer(1n), {}), Type.bitstringSegment(Type.integer(2n), {})])"
    end
  end

  describe "bitstring segment" do
    test "no modifiers specified" do
      # <<123>>
      ir = %IR.BitstringSegment{
        value: %IR.IntegerType{value: 123},
        modifiers: []
      }

      assert encode(ir, %Context{}) == "Type.bitstringSegment(Type.integer(123n), {})"
    end

    test "all modifiers specified" do
      # <<123::integer-size(16)-unit(1)-signed-big>>
      ir = %IR.BitstringSegment{
        value: %IR.IntegerType{value: 123},
        modifiers: [
          type: :integer,
          size: %IR.IntegerType{value: 16},
          unit: 1,
          signedness: :signed,
          endianness: :big
        ]
      }

      assert encode(ir, %Context{}) ==
               ~s/Type.bitstringSegment(Type.integer(123n), {type: "integer", size: Type.integer(16n), unit: 1n, signedness: "signed", endianness: "big"})/
    end

    test "single modifier specified" do
      # <<123::big>>
      ir = %IR.BitstringSegment{
        value: %IR.IntegerType{value: 123},
        modifiers: [endianness: :big]
      }

      assert encode(ir, %Context{}) ==
               ~s/Type.bitstringSegment(Type.integer(123n), {endianness: "big"})/
    end

    test "from string type" do
      # <<"abc">>
      ir = %IR.BitstringSegment{value: %IR.StringType{value: "abc"}, modifiers: [type: "utf8"]}

      assert encode(ir, %Context{}) ==
               ~s/Type.bitstringSegment(Type.string(\"abc\"), {type: "utf8"})/
    end

    test "from non-string type" do
      # <<123::big>>
      ir = %IR.BitstringSegment{
        value: %IR.IntegerType{value: 123},
        modifiers: [endianness: :big]
      }

      assert encode(ir, %Context{}) ==
               ~s/Type.bitstringSegment(Type.integer(123n), {endianness: "big"})/
    end
  end

  describe "block" do
    test "empty" do
      # do
      # end
      ir = %IR.Block{expressions: []}

      assert encode(ir, %Context{}) ==
               """
               {
               return Type.atom("nil");
               }\
               """
    end

    test "single expression" do
      # do
      #   1
      # end
      ir = %IR.Block{
        expressions: [
          %IR.IntegerType{value: 1}
        ]
      }

      assert encode(ir, %Context{}) ==
               """
               {
               return Type.integer(1n);
               }\
               """
    end

    test "multiple expressions" do
      # do
      #   1
      #   2
      # end
      ir = %IR.Block{
        expressions: [
          %IR.IntegerType{value: 1},
          %IR.IntegerType{value: 2}
        ]
      }

      assert encode(ir, %Context{}) ==
               """
               {
               Type.integer(1n);
               return Type.integer(2n);
               }\
               """
    end

    test "expression not using vars snapshot" do
      # x + (y = 123)
      ir = %IR.Block{
        expressions: [
          %IR.RemoteFunctionCall{
            module: %IR.AtomType{value: :erlang},
            function: :+,
            args: [
              %IR.Variable{name: :x},
              %IR.MatchOperator{left: %IR.Variable{name: :y}, right: %IR.IntegerType{value: 123}}
            ]
          },
          %IR.AtomType{value: :ok}
        ]
      }

      assert encode(ir, %Context{}) ==
               """
               {
               Erlang["+/2"](vars.x, Interpreter.matchOperator(Type.integer(123n), Type.variablePattern("y"), vars));
               return Type.atom("ok");
               }\
               """
    end

    test "expression using vars snapshot" do
      # x + (x = 123)
      ir = %IR.Block{
        expressions: [
          %IR.RemoteFunctionCall{
            module: %IR.AtomType{value: :erlang},
            function: :+,
            args: [
              %IR.Variable{name: :x},
              %IR.MatchOperator{left: %IR.Variable{name: :x}, right: %IR.IntegerType{value: 123}}
            ]
          },
          %IR.AtomType{value: :ok}
        ]
      }

      assert encode(ir, %Context{}) ==
               """
               {
               Interpreter.takeVarsSnapshot(vars);
               Erlang["+/2"](vars.__snapshot__.x, Interpreter.matchOperator(Type.integer(123n), Type.variablePattern("x"), vars));
               return Type.atom("ok");
               }\
               """
    end
  end

  test "case" do
    # case my_var do
    #   x when x == 100 -> :ok
    #   y -> y
    # end
    #
    # case my_var do
    #   x when :erlang.==(x, 100) -> :ok
    #   y -> y
    # end
    ir = %IR.Case{
      condition: %IR.Variable{name: :my_var},
      clauses: [
        %IR.Clause{
          match: %IR.Variable{name: :x},
          guards: [
            %IR.RemoteFunctionCall{
              module: %IR.AtomType{value: :erlang},
              function: :==,
              args: [
                %IR.Variable{name: :x},
                %IR.IntegerType{value: 100}
              ]
            }
          ],
          body: %IR.Block{
            expressions: [%IR.AtomType{value: :ok}]
          }
        },
        %IR.Clause{
          match: %IR.Variable{name: :y},
          guards: [],
          body: %IR.Block{
            expressions: [%IR.Variable{name: :y}]
          }
        }
      ]
    }

    assert encode(ir, %Context{}) == """
           Interpreter.case(vars.my_var, [{match: Type.variablePattern("x"), guards: [(vars) => Erlang["==/2"](vars.x, Type.integer(100n))], body: (vars) => {
           return Type.atom("ok");
           }}, {match: Type.variablePattern("y"), guards: [], body: (vars) => {
           return vars.y;
           }}])\
           """
  end

  describe "clause" do
    test "no guards" do
      # case 1 do
      #   x -> 1
      # end
      ir = %IR.Clause{
        match: %IR.Variable{name: :x},
        guards: [],
        body: %IR.Block{
          expressions: [%IR.IntegerType{value: 1}]
        }
      }

      assert encode(ir, %Context{}) ==
               "{match: Type.variablePattern(\"x\"), guards: [], body: (vars) => {\nreturn Type.integer(1n);\n}}"
    end

    test "single guard" do
      # case 1 do
      #   x when y -> 1
      # end
      ir = %IR.Clause{
        match: %IR.Variable{name: :x},
        guards: [%IR.Variable{name: :y}],
        body: %IR.Block{
          expressions: [%IR.IntegerType{value: 1}]
        }
      }

      assert encode(ir, %Context{}) ==
               "{match: Type.variablePattern(\"x\"), guards: [(vars) => vars.y], body: (vars) => {\nreturn Type.integer(1n);\n}}"
    end

    test "multiple guards" do
      # case 1 do
      #   x when y when z -> 1
      # end
      ir = %IR.Clause{
        match: %IR.Variable{name: :x},
        guards: [%IR.Variable{name: :y}, %IR.Variable{name: :z}],
        body: %IR.Block{
          expressions: [%IR.IntegerType{value: 1}]
        }
      }

      assert encode(ir, %Context{}) ==
               "{match: Type.variablePattern(\"x\"), guards: [(vars) => vars.y, (vars) => vars.z], body: (vars) => {\nreturn Type.integer(1n);\n}}"
    end
  end

  test "comprehension" do
    # for x when x < 3 <- [1, 2],
    #     y when y < 5 <- [3, 4],
    #     is_integer(x),
    #     is_integer(y),
    #     into: %{},
    #     uniq: true,
    #     do: {x, y}
    #
    # for x when :erlang.<(x, 3) <- [1, 2],
    #     y when :erlang.<(y, 5) <- [3, 4],
    #     :erlang.is_integer(x),
    #     :erlang.is_integer(y),
    #     into: %{},
    #     uniq: true,
    #     do: {x, y}

    ir = %IR.Comprehension{
      generators: [
        %IR.Clause{
          match: %IR.Variable{name: :x},
          guards: [
            %IR.RemoteFunctionCall{
              module: %IR.AtomType{value: :erlang},
              function: :<,
              args: [
                %IR.Variable{name: :x},
                %IR.IntegerType{value: 3}
              ]
            }
          ],
          body: %IR.ListType{
            data: [
              %IR.IntegerType{value: 1},
              %IR.IntegerType{value: 2}
            ]
          }
        },
        %IR.Clause{
          match: %IR.Variable{name: :y},
          guards: [
            %IR.RemoteFunctionCall{
              module: %IR.AtomType{value: :erlang},
              function: :<,
              args: [
                %IR.Variable{name: :y},
                %IR.IntegerType{value: 5}
              ]
            }
          ],
          body: %IR.ListType{
            data: [
              %IR.IntegerType{value: 3},
              %IR.IntegerType{value: 4}
            ]
          }
        }
      ],
      filters: [
        %IR.ComprehensionFilter{
          expression: %IR.RemoteFunctionCall{
            module: %IR.AtomType{value: :erlang},
            function: :is_integer,
            args: [%IR.Variable{name: :x}]
          }
        },
        %IR.ComprehensionFilter{
          expression: %IR.RemoteFunctionCall{
            module: %IR.AtomType{value: :erlang},
            function: :is_integer,
            args: [%IR.Variable{name: :y}]
          }
        }
      ],
      collectable: %IR.MapType{data: []},
      unique: %IR.AtomType{value: true},
      mapper: %IR.TupleType{
        data: [
          %IR.Variable{name: :x},
          %IR.Variable{name: :y}
        ]
      }
    }

    assert encode(ir, %Context{}) ==
             "Interpreter.comprehension([{match: Type.variablePattern(\"x\"), guards: [(vars) => Erlang[\"</2\"](vars.x, Type.integer(3n))], body: (vars) => Type.list([Type.integer(1n), Type.integer(2n)])}, {match: Type.variablePattern(\"y\"), guards: [(vars) => Erlang[\"</2\"](vars.y, Type.integer(5n))], body: (vars) => Type.list([Type.integer(3n), Type.integer(4n)])}], [(vars) => Erlang[\"is_integer/1\"](vars.x), (vars) => Erlang[\"is_integer/1\"](vars.y)], Type.map([]), true, (vars) => Type.tuple([vars.x, vars.y]), vars)"
  end

  test "comprehension filter" do
    # my_filter(a)
    ir = %IR.ComprehensionFilter{
      expression: %IR.LocalFunctionCall{
        function: :my_filter,
        args: [%IR.Variable{name: :a}]
      }
    }

    assert encode(ir, %Context{module: MyModule}) ==
             "(vars) => Elixir_MyModule[\"my_filter/1\"](vars.a)"
  end

  test "comprehension generator" do
    # {a, b} when my_guard(a, 2) -> [1, 2]
    ir = %IR.Clause{
      match: %IR.TupleType{
        data: [
          %IR.Variable{name: :a},
          %IR.Variable{name: :b}
        ]
      },
      guards: [
        %IR.LocalFunctionCall{
          function: :my_guard,
          args: [
            %IR.Variable{name: :a},
            %IR.IntegerType{value: 2}
          ]
        }
      ],
      body: %IR.ListType{
        data: [
          %IR.IntegerType{value: 1},
          %IR.IntegerType{value: 2}
        ]
      }
    }

    assert encode(ir, %Context{module: MyModule}) ==
             "{match: Type.tuple([Type.variablePattern(\"a\"), Type.variablePattern(\"b\")]), guards: [(vars) => Elixir_MyModule[\"my_guard/2\"](vars.a, Type.integer(2n))], body: (vars) => Type.list([Type.integer(1n), Type.integer(2n)])}"
  end

  test "cond" do
    clause_1 = %IR.CondClause{
      condition: %IR.RemoteFunctionCall{
        module: %IR.AtomType{value: :erlang},
        function: :<,
        args: [
          %IR.Variable{name: :x},
          %IR.IntegerType{value: 1}
        ]
      },
      body: %IR.Block{
        expressions: [
          %IR.IntegerType{value: 1}
        ]
      }
    }

    clause_2 = %IR.CondClause{
      condition: %IR.RemoteFunctionCall{
        module: %IR.AtomType{value: :erlang},
        function: :<,
        args: [
          %IR.Variable{name: :x},
          %IR.IntegerType{value: 2}
        ]
      },
      body: %IR.Block{
        expressions: [
          %IR.IntegerType{value: 2}
        ]
      }
    }

    # cond do
    #   :erlang.<(x, 1) -> 1
    #   :erlang.<(x, 2) -> 2
    # end
    ir = %IR.Cond{clauses: [clause_1, clause_2]}

    assert encode(ir, %Context{}) == """
           Interpreter.cond([{condition: (vars) => Erlang["</2"](vars.x, Type.integer(1n)), body: (vars) => {
           return Type.integer(1n);
           }}, {condition: (vars) => Erlang["</2"](vars.x, Type.integer(2n)), body: (vars) => {
           return Type.integer(2n);
           }}])\
           """
  end

  test "cond clause" do
    # :erlang.<(x, 3) ->
    #   1
    #   2
    ir = %IR.CondClause{
      condition: %IR.RemoteFunctionCall{
        module: %IR.AtomType{value: :erlang},
        function: :<,
        args: [
          %IR.Variable{name: :x},
          %IR.IntegerType{value: 3}
        ]
      },
      body: %IR.Block{
        expressions: [
          %IR.IntegerType{value: 1},
          %IR.IntegerType{value: 2}
        ]
      }
    }

    assert encode(ir, %Context{}) == """
           {condition: (vars) => Erlang[\"</2\"](vars.x, Type.integer(3n)), body: (vars) => {
           Type.integer(1n);
           return Type.integer(2n);
           }}\
           """
  end

  describe "cons operator" do
    # [1 | [2, 3]]
    @cons_operator_ir %IR.ConsOperator{
      head: %IR.IntegerType{value: 1},
      tail: %IR.ListType{data: [%IR.IntegerType{value: 2}, %IR.IntegerType{value: 3}]}
    }

    test "not inside pattern" do
      assert encode(@cons_operator_ir, %Context{pattern?: false}) ==
               "Interpreter.consOperator(Type.integer(1n), Type.list([Type.integer(2n), Type.integer(3n)]))"
    end

    test "inside pattern" do
      assert encode(@cons_operator_ir, %Context{pattern?: true}) ==
               "Type.consPattern(Type.integer(1n), Type.list([Type.integer(2n), Type.integer(3n)]))"
    end
  end

  test "dot operator" do
    # my_module.my_key
    ir = %IR.DotOperator{
      left: %IR.Variable{name: :my_module},
      right: %IR.AtomType{value: :my_key}
    }

    assert encode(ir, %Context{}) ==
             "Interpreter.dotOperator(vars.my_module, Type.atom(\"my_key\"))"
  end

  test "float type" do
    # 1.23
    assert encode(%IR.FloatType{value: 1.23}, %Context{}) == "Type.float(1.23)"
  end

  describe "function clause" do
    # (x, y) do
    #  :expr_1
    #  :expr_2
    test "without guard" do
      ir = %IR.FunctionClause{
        params: [%IR.Variable{name: :x}, %IR.Variable{name: :y}],
        guards: [],
        body: %IR.Block{
          expressions: [%IR.AtomType{value: :expr_1}, %IR.AtomType{value: :expr_2}]
        }
      }

      assert encode(ir, %Context{}) == """
             {params: (vars) => [Type.variablePattern("x"), Type.variablePattern("y")], guards: [], body: (vars) => {
             Type.atom("expr_1");
             return Type.atom("expr_2");
             }}\
             """
    end

    test "with single guard" do
      # (x, y) when :erlang.is_integer(x) do
      #  :expr_1
      #  :expr_2
      ir = %IR.FunctionClause{
        params: [%IR.Variable{name: :x}, %IR.Variable{name: :y}],
        guards: [
          %IR.RemoteFunctionCall{
            module: %IR.AtomType{value: :erlang},
            function: :is_integer,
            args: [%IR.Variable{name: :x}]
          }
        ],
        body: %IR.Block{
          expressions: [%IR.AtomType{value: :expr_1}, %IR.AtomType{value: :expr_2}]
        }
      }

      assert encode(ir, %Context{}) == """
             {params: (vars) => [Type.variablePattern("x"), Type.variablePattern("y")], guards: [(vars) => Erlang["is_integer/1"](vars.x)], body: (vars) => {
             Type.atom("expr_1");
             return Type.atom("expr_2");
             }}\
             """
    end

    test "with multiple guards" do
      # (x, y) when :erlang.is_integer(x) when :erlang.is_integer(y) do
      #  :expr_1
      #  :expr_2
      ir = %IR.FunctionClause{
        params: [%IR.Variable{name: :x}, %IR.Variable{name: :y}],
        guards: [
          %IR.RemoteFunctionCall{
            module: %IR.AtomType{value: :erlang},
            function: :is_integer,
            args: [%IR.Variable{name: :x}]
          },
          %IR.RemoteFunctionCall{
            module: %IR.AtomType{value: :erlang},
            function: :is_integer,
            args: [%IR.Variable{name: :y}]
          }
        ],
        body: %IR.Block{
          expressions: [%IR.AtomType{value: :expr_1}, %IR.AtomType{value: :expr_2}]
        }
      }

      assert encode(ir, %Context{}) == """
             {params: (vars) => [Type.variablePattern("x"), Type.variablePattern("y")], guards: [(vars) => Erlang["is_integer/1"](vars.x), (vars) => Erlang["is_integer/1"](vars.y)], body: (vars) => {
             Type.atom("expr_1");
             return Type.atom("expr_2");
             }}\
             """
    end

    test "with match operator in param" do
      # (x = 1 = y) do
      #  :ok
      ir = %IR.FunctionClause{
        params: [
          %IR.MatchOperator{
            left: %IR.Variable{name: :x},
            right: %IR.MatchOperator{
              left: %IR.IntegerType{value: 1},
              right: %IR.Variable{name: :y}
            }
          }
        ],
        guards: [],
        body: %IR.Block{
          expressions: [%IR.AtomType{value: :ok}]
        }
      }

      assert encode(ir, %Context{}) == """
             {params: (vars) => [Interpreter.matchOperator(Interpreter.matchOperator(Type.variablePattern("y"), Type.integer(1n), vars, false), Type.variablePattern("x"), vars)], guards: [], body: (vars) => {
             return Type.atom("ok");
             }}\
             """
    end
  end

  test "integer type" do
    # 123
    assert encode(%IR.IntegerType{value: 123}, %Context{}) == "Type.integer(123n)"
  end

  describe "list type" do
    test "empty" do
      # []
      assert encode(%IR.ListType{data: []}, %Context{}) == "Type.list([])"
    end

    test "non-empty" do
      # [1, :abc]
      ir = %IR.ListType{
        data: [
          %IR.IntegerType{value: 1},
          %IR.AtomType{value: :abc}
        ]
      }

      assert encode(ir, %Context{}) == ~s/Type.list([Type.integer(1n), Type.atom("abc")])/
    end
  end

  test "local function call" do
    # my_fun!(1, 2)
    ir = %IR.LocalFunctionCall{
      function: :my_fun!,
      args: [%IR.IntegerType{value: 1}, %IR.IntegerType{value: 2}]
    }

    assert encode(ir, %Context{module: Aaa.Bbb.Ccc}) ==
             "Elixir_Aaa_Bbb_Ccc[\"my_fun!/2\"](Type.integer(1n), Type.integer(2n))"
  end

  describe "map type" do
    test "empty" do
      # %{}
      assert encode(%IR.MapType{data: []}, %Context{}) == "Type.map([])"
    end

    test "single key" do
      # %{a: 1}
      ir = %IR.MapType{
        data: [
          {
            %IR.AtomType{value: :a},
            %IR.IntegerType{value: 1}
          }
        ]
      }

      assert encode(ir, %Context{}) == ~s/Type.map([[Type.atom("a"), Type.integer(1n)]])/
    end

    test "multiple keys" do
      # %{a: 1, b: 2}
      ir = %IR.MapType{
        data: [
          {%IR.AtomType{value: :a}, %IR.IntegerType{value: 1}},
          {%IR.AtomType{value: :b}, %IR.IntegerType{value: 2}}
        ]
      }

      assert encode(ir, %Context{}) ==
               ~s/Type.map([[Type.atom("a"), Type.integer(1n)], [Type.atom("b"), Type.integer(2n)]])/
    end
  end

  describe "match operator" do
    test "literal value on both sides" do
      # 1 = 2
      ir = %IR.MatchOperator{
        left: %IR.IntegerType{value: 1},
        right: %IR.IntegerType{value: 2}
      }

      assert encode(ir, %Context{}) ==
               "Interpreter.matchOperator(Type.integer(2n), Type.integer(1n), vars)"
    end

    test "variable in pattern" do
      # x = 2
      ir = %IR.MatchOperator{
        left: %IR.Variable{name: :x},
        right: %IR.IntegerType{value: 2}
      }

      assert encode(ir, %Context{}) ==
               ~s/Interpreter.matchOperator(Type.integer(2n), Type.variablePattern("x"), vars)/
    end

    test "variable in expression" do
      # 1 = x
      ir = %IR.MatchOperator{
        left: %IR.IntegerType{value: 1},
        right: %IR.Variable{name: :x}
      }

      assert encode(ir, %Context{}) ==
               "Interpreter.matchOperator(vars.x, Type.integer(1n), vars)"
    end

    test "nested, variable in pattern" do
      # x = 2 = 3
      ir = %IR.MatchOperator{
        left: %IR.Variable{name: :x},
        right: %IR.MatchOperator{
          left: %IR.IntegerType{value: 2},
          right: %IR.IntegerType{value: 3}
        }
      }

      assert encode(ir, %Context{}) ==
               ~s/Interpreter.matchOperator(Interpreter.matchOperator(Type.integer(3n), Type.integer(2n), vars, false), Type.variablePattern("x"), vars)/
    end

    test "nested, variable in the middle" do
      # 1 = x = 3
      ir = %IR.MatchOperator{
        left: %IR.IntegerType{value: 1},
        right: %IR.MatchOperator{
          left: %IR.Variable{name: :x},
          right: %IR.IntegerType{value: 3}
        }
      }

      assert encode(ir, %Context{}) ==
               ~s/Interpreter.matchOperator(Interpreter.matchOperator(Type.integer(3n), Type.variablePattern("x"), vars, false), Type.integer(1n), vars)/
    end

    test "nested, variable in expression" do
      # 1 = 2 = x
      ir = %IR.MatchOperator{
        left: %IR.IntegerType{value: 1},
        right: %IR.MatchOperator{
          left: %IR.IntegerType{value: 2},
          right: %IR.Variable{name: :x}
        }
      }

      assert encode(ir, %Context{}) ==
               "Interpreter.matchOperator(Interpreter.matchOperator(vars.x, Type.integer(2n), vars, false), Type.integer(1n), vars)"
    end

    test "nested multiple-times" do
      # {a = b, 2, 3} = {1, c = d, 3} = {1, 2, e = f}
      ir = %IR.MatchOperator{
        left: %IR.TupleType{
          data: [
            %IR.MatchOperator{
              left: %IR.Variable{name: :a},
              right: %IR.Variable{name: :b}
            },
            %IR.IntegerType{value: 2},
            %IR.IntegerType{value: 3}
          ]
        },
        right: %IR.MatchOperator{
          left: %IR.TupleType{
            data: [
              %IR.IntegerType{value: 1},
              %IR.MatchOperator{
                left: %IR.Variable{name: :c},
                right: %IR.Variable{name: :d}
              },
              %IR.IntegerType{value: 3}
            ]
          },
          right: %IR.TupleType{
            data: [
              %IR.IntegerType{value: 1},
              %IR.IntegerType{value: 2},
              %IR.MatchOperator{
                left: %IR.Variable{name: :e},
                right: %IR.Variable{name: :f}
              }
            ]
          }
        }
      }

      assert encode(ir, %Context{}) ==
               ~s/Interpreter.matchOperator(Interpreter.matchOperator(Type.tuple([Type.integer(1n), Type.integer(2n), Interpreter.matchOperator(vars.f, Type.variablePattern("e"), vars, false)]), Type.tuple([Type.integer(1n), Interpreter.matchOperator(Type.variablePattern("d"), Type.variablePattern("c"), vars, false), Type.integer(3n)]), vars, false), Type.tuple([Interpreter.matchOperator(Type.variablePattern("b"), Type.variablePattern("a"), vars, false), Type.integer(2n), Type.integer(3n)]), vars)/
    end
  end

  test "match placeholder" do
    # _abc
    assert encode(%IR.MatchPlaceholder{}, %Context{}) == "Type.matchPlaceholder()"
  end

  test "module attribute operator" do
    # @abc?
    assert encode(%IR.ModuleAttributeOperator{name: :abc?}, %Context{}) == "vars.$264abc$263"
  end

  test "module definition" do
    # defmodule Aaa.Bbb do
    #   def fun_1(9, 8), :expr_1

    #   def fun_1(c) when :erlang.is_integer(c), do: c

    #   def fun_1(a, b) do
    #     :erlang.+(a, b)
    #   end

    #   defp fun_2(x, y) do
    #     :erlang.*(x, y)
    #   end

    #   defp fun_2(9), do: :expr_2

    #   defp fun_2(z) when :erlang.is_float(z), do: z
    # end
    ir = %IR.ModuleDefinition{
      module: %IR.AtomType{value: Aaa.Bbb},
      body: %IR.Block{
        expressions: [
          %IR.FunctionDefinition{
            name: :fun_1,
            arity: 2,
            visibility: :public,
            clause: %IR.FunctionClause{
              params: [
                %IR.IntegerType{value: 9},
                %IR.IntegerType{value: 8}
              ],
              guards: [],
              body: %IR.Block{
                expressions: [%IR.AtomType{value: :expr_1}]
              }
            }
          },
          %IR.FunctionDefinition{
            name: :fun_1,
            arity: 1,
            visibility: :public,
            clause: %IR.FunctionClause{
              params: [%IR.Variable{name: :c}],
              guards: [
                %IR.RemoteFunctionCall{
                  module: %IR.AtomType{value: :erlang},
                  function: :is_integer,
                  args: [%IR.Variable{name: :c}]
                }
              ],
              body: %IR.Block{
                expressions: [%IR.Variable{name: :c}]
              }
            }
          },
          %IR.FunctionDefinition{
            name: :fun_1,
            arity: 2,
            visibility: :public,
            clause: %IR.FunctionClause{
              params: [
                %IR.Variable{name: :a},
                %IR.Variable{name: :b}
              ],
              guards: [],
              body: %IR.Block{
                expressions: [
                  %IR.RemoteFunctionCall{
                    module: %IR.AtomType{value: :erlang},
                    function: :+,
                    args: [
                      %IR.Variable{name: :a},
                      %IR.Variable{name: :b}
                    ]
                  }
                ]
              }
            }
          },
          %IR.FunctionDefinition{
            name: :fun_2,
            arity: 2,
            visibility: :private,
            clause: %IR.FunctionClause{
              params: [
                %IR.Variable{name: :x},
                %IR.Variable{name: :y}
              ],
              guards: [],
              body: %IR.Block{
                expressions: [
                  %IR.RemoteFunctionCall{
                    module: %IR.AtomType{value: :erlang},
                    function: :*,
                    args: [
                      %IR.Variable{name: :x},
                      %IR.Variable{name: :y}
                    ]
                  }
                ]
              }
            }
          },
          %IR.FunctionDefinition{
            name: :fun_2,
            arity: 1,
            visibility: :private,
            clause: %IR.FunctionClause{
              params: [%IR.IntegerType{value: 9}],
              guards: [],
              body: %IR.Block{
                expressions: [%IR.AtomType{value: :expr_2}]
              }
            }
          },
          %IR.FunctionDefinition{
            name: :fun_2,
            arity: 1,
            visibility: :private,
            clause: %IR.FunctionClause{
              params: [%IR.Variable{name: :z}],
              guards: [
                %IR.RemoteFunctionCall{
                  module: %IR.AtomType{value: :erlang},
                  function: :is_float,
                  args: [%IR.Variable{name: :z}]
                }
              ],
              body: %IR.Block{
                expressions: [%IR.Variable{name: :z}]
              }
            }
          }
        ]
      }
    }

    assert encode(ir, %Context{}) == """
           Interpreter.defineElixirFunction("Elixir_Aaa_Bbb", "fun_1", 1, [{params: (vars) => [Type.variablePattern("c")], guards: [(vars) => Erlang["is_integer/1"](vars.c)], body: (vars) => {
           return vars.c;
           }}]);

           Interpreter.defineElixirFunction("Elixir_Aaa_Bbb", "fun_1", 2, [{params: (vars) => [Type.integer(9n), Type.integer(8n)], guards: [], body: (vars) => {
           return Type.atom("expr_1");
           }}, {params: (vars) => [Type.variablePattern("a"), Type.variablePattern("b")], guards: [], body: (vars) => {
           return Erlang["+/2"](vars.a, vars.b);
           }}]);

           Interpreter.defineElixirFunction("Elixir_Aaa_Bbb", "fun_2", 1, [{params: (vars) => [Type.integer(9n)], guards: [], body: (vars) => {
           return Type.atom("expr_2");
           }}, {params: (vars) => [Type.variablePattern("z")], guards: [(vars) => Erlang["is_float/1"](vars.z)], body: (vars) => {
           return vars.z;
           }}]);

           Interpreter.defineElixirFunction("Elixir_Aaa_Bbb", "fun_2", 2, [{params: (vars) => [Type.variablePattern("x"), Type.variablePattern("y")], guards: [], body: (vars) => {
           return Erlang["*/2"](vars.x, vars.y);
           }}]);\
           """
  end

  test "pin operator" do
    # ^abc
    assert encode(%IR.PinOperator{name: :abc}, %Context{}) == "vars.abc"
  end

  describe "remote function call" do
    test "called on a module alias" do
      # Aaa.Bbb.Ccc.my_fun!(1, 2)
      ir = %IR.RemoteFunctionCall{
        module: %IR.AtomType{value: Aaa.Bbb.Ccc},
        function: :my_fun!,
        args: [%IR.IntegerType{value: 1}, %IR.IntegerType{value: 2}]
      }

      assert encode(ir, %Context{}) ==
               "Elixir_Aaa_Bbb_Ccc[\"my_fun!/2\"](Type.integer(1n), Type.integer(2n))"
    end

    test "called on variable" do
      # x.my_fun!(1, 2)
      ir = %IR.RemoteFunctionCall{
        module: %IR.Variable{name: :x},
        function: :my_fun!,
        args: [%IR.IntegerType{value: 1}, %IR.IntegerType{value: 2}]
      }

      assert encode(ir, %Context{}) ==
               "Interpreter.callNamedFunction(vars.x, \"my_fun!/2\", [Type.integer(1n), Type.integer(2n)])"
    end

    test "called on expression" do
      # (case my_var do
      #   :a -> MyModule1
      #   :b -> MyModule2
      # end).my_fun!(1, 2)
      ir = %IR.RemoteFunctionCall{
        module: %IR.Case{
          condition: %IR.Variable{name: :my_var},
          clauses: [
            %IR.Clause{
              match: %IR.AtomType{value: :a},
              guards: [],
              body: %IR.Block{
                expressions: [%IR.AtomType{value: MyModule1}]
              }
            },
            %IR.Clause{
              match: %IR.AtomType{value: :b},
              guards: [],
              body: %IR.Block{
                expressions: [%IR.AtomType{value: MyModule2}]
              }
            }
          ]
        },
        function: :my_fun!,
        args: [
          %IR.IntegerType{value: 1},
          %IR.IntegerType{value: 2}
        ]
      }

      assert encode(ir, %Context{module: MyModule}) == """
             Interpreter.callNamedFunction(Interpreter.case(vars.my_var, [{match: Type.atom("a"), guards: [], body: (vars) => {
             return Type.atom("Elixir.MyModule1");
             }}, {match: Type.atom("b"), guards: [], body: (vars) => {
             return Type.atom("Elixir.MyModule2");
             }}]), "my_fun!/2", [Type.integer(1n), Type.integer(2n)])\
             """
    end
  end

  test "string type" do
    # "aa\"bb\ncc"
    ir = %IR.StringType{value: "aa\"bb\ncc"}

    assert encode(ir, %Context{}) == ~s/Type.bitstring("aa\\"bb\\ncc")/
  end

  describe "tuple type" do
    test "empty" do
      # {}
      assert encode(%IR.TupleType{data: []}, %Context{}) == "Type.tuple([])"
    end

    test "non-empty" do
      # {1, :abc}
      ir = %IR.TupleType{
        data: [
          %IR.IntegerType{value: 1},
          %IR.AtomType{value: :abc}
        ]
      }

      assert encode(ir, %Context{}) == ~s/Type.tuple([Type.integer(1n), Type.atom("abc")])/
    end
  end

  describe "variable" do
    test "not inside pattern" do
      # my_var
      assert encode(%IR.Variable{name: :my_var}, %Context{pattern?: false}) == "vars.my_var"
    end

    test "inside pattern" do
      # my_var
      assert encode(%IR.Variable{name: :my_var}, %Context{pattern?: true}) ==
               ~s/Type.variablePattern("my_var")/
    end

    test "escape" do
      # my_var?
      assert encode(%IR.Variable{name: :my_var?}, %Context{}) == "vars.my_var$263"
    end
  end

  describe "encode_as_class_name/1" do
    test "Elixir module alias without camel case segments" do
      assert encode_as_class_name(Aaa.Bbb.Ccc) == "Elixir_Aaa_Bbb_Ccc"
    end

    test "Elixir module alias with camel case segments" do
      assert encode_as_class_name(AaaBbb.CccDdd) == "Elixir_AaaBbb_CccDdd"
    end

    test ":erlang alias" do
      assert encode_as_class_name(:erlang) == "Erlang"
    end

    test "single-segment Erlang module alias" do
      assert encode_as_class_name(:aaa) == "Erlang_Aaa"
    end

    test "multiple-segment Erlang module alias" do
      assert encode_as_class_name(:aaa_bbb) == "Erlang_Aaa_Bbb"
    end
  end

  test "encode_term/1" do
    my_var = 123
    assert encode_term(my_var) == "Type.integer(123n)"
  end

  describe "escape_js_identifier/1" do
    test "escape characters which are not allowed in JS identifiers" do
      assert escape_js_identifier("@[^`{") == "$264$291$294$296$3123"
    end

    test "escape $ (dollar sign) character" do
      assert escape_js_identifier("$") == "$236"
    end

    test "does not escape characters which are allowed in JS identifiers" do
      str = "059AKZakz_"
      assert escape_js_identifier(str) == str
    end
  end
end
