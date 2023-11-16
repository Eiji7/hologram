"use strict";

import {
  assert,
  assertBoxedError,
  assertMatchError,
  linkModules,
  sinon,
  unlinkModules,
} from "../../assets/js/test_support.mjs";
import Erlang from "../../assets/js/erlang/erlang.mjs";
import HologramBoxedError from "../../assets/js/errors/boxed_error.mjs";
import HologramInterpreterError from "../../assets/js/errors/interpreter_error.mjs";
import Interpreter from "../../assets/js/interpreter.mjs";
import Type from "../../assets/js/type.mjs";

const clone = Interpreter.cloneVars;

before(() => linkModules());
after(() => unlinkModules());

describe("callAnonymousFunction()", () => {
  let vars, anonFun;

  beforeEach(() => {
    vars = {a: Type.integer(5), b: Type.integer(6), x: Type.integer(9)};

    // fn
    //   1 -> :expr_1
    //   2 -> :expr_2
    // end
    anonFun = Type.anonymousFunction(
      1,
      [
        {
          params: (_vars) => [Type.integer(1)],
          guards: [],
          body: (_vars) => {
            return Type.atom("expr_1");
          },
        },
        {
          params: (_vars) => [Type.integer(2)],
          guards: [],
          body: (_vars) => {
            return Type.atom("expr_2");
          },
        },
      ],
      vars,
    );
  });

  it("runs the first matching clause", () => {
    const result = Interpreter.callAnonymousFunction(anonFun, [
      Type.integer(1),
    ]);

    assert.deepStrictEqual(result, Type.atom("expr_1"));
  });

  it("ignores not matching clauses", () => {
    const result = Interpreter.callAnonymousFunction(anonFun, [
      Type.integer(2),
    ]);

    assert.deepStrictEqual(result, Type.atom("expr_2"));
  });

  it("runs guards for each tried clause", () => {
    // fn
    //   x when x == 1 -> :expr_1
    //   y when y == 2 -> :expr_2
    //   z when z == 3 -> :expr_3
    // end
    const anonFun = Type.anonymousFunction(
      1,
      [
        {
          params: (_vars) => [Type.variablePattern("x")],
          guards: [(vars) => Erlang["==/2"](vars.x, Type.integer(1))],
          body: (_vars) => {
            return Type.atom("expr_1");
          },
        },
        {
          params: (_vars) => [Type.variablePattern("y")],
          guards: [(vars) => Erlang["==/2"](vars.y, Type.integer(2))],
          body: (_vars) => {
            return Type.atom("expr_2");
          },
        },
        {
          params: (_vars) => [Type.variablePattern("z")],
          guards: [(vars) => Erlang["==/2"](vars.z, Type.integer(3))],
          body: (_vars) => {
            return Type.atom("expr_3");
          },
        },
      ],
      vars,
    );

    const result = Interpreter.callAnonymousFunction(anonFun, [
      Type.integer(3),
    ]);

    assert.deepStrictEqual(result, Type.atom("expr_3"));
  });

  it("runs mutliple guards", () => {
    // fn x when x == 1 when x == 2 -> x end
    //
    // fn x when :erlang.==(x, 1) when :erlang.==(x, 2) -> x end
    const anonFun = Type.anonymousFunction(
      1,
      [
        {
          params: (_vars) => [Type.variablePattern("x")],
          guards: [
            (vars) => Erlang["==/2"](vars.x, Type.integer(1)),
            (vars) => Erlang["==/2"](vars.x, Type.integer(2)),
          ],
          body: (vars) => {
            return vars.x;
          },
        },
      ],
      vars,
    );

    const result1 = Interpreter.callAnonymousFunction(anonFun, [
      Type.integer(1),
    ]);

    assert.deepStrictEqual(result1, Type.integer(1));

    const result2 = Interpreter.callAnonymousFunction(anonFun, [
      Type.integer(2),
    ]);

    assert.deepStrictEqual(result2, Type.integer(2));

    assertBoxedError(
      () => Interpreter.callAnonymousFunction(anonFun, [Type.integer(3)]),
      "FunctionClauseError",
      "no function clause matching in anonymous fn/1",
    );
  });

  it("clones vars for each clause and has access to vars from closure", () => {
    // x = 9
    //
    // fn
    //   x, 1 when x == 1 -> :expr_1
    //   y, 2 -> x
    // end
    const anonFun = Type.anonymousFunction(
      2,
      [
        {
          params: (_vars) => [Type.variablePattern("x"), Type.integer(1)],
          guards: [(vars) => Erlang["==/2"](vars.x, Type.integer(1))],
          body: (_vars) => {
            return Type.atom("expr_1");
          },
        },
        {
          params: (_vars) => [Type.variablePattern("y"), Type.integer(2)],
          guards: [],
          body: (vars) => {
            return vars.x;
          },
        },
      ],
      vars,
    );

    const result = Interpreter.callAnonymousFunction(anonFun, [
      Type.integer(2),
      Type.integer(2),
    ]);

    assert.deepStrictEqual(result, Type.integer(9));
  });

  it("raises FunctionClauseError error if none of the clauses is matched", () => {
    assertBoxedError(
      () => Interpreter.callAnonymousFunction(anonFun, [Type.integer(3)]),
      "FunctionClauseError",
      "no function clause matching in anonymous fn/1",
    );
  });

  it("has match operator in the clause pattern", () => {
    // fn x = 1 = y -> x + y end
    const anonFun = Type.anonymousFunction(
      1,
      [
        {
          params: (vars) => [
            Interpreter.matchOperator(
              Interpreter.matchOperator(
                Type.variablePattern("y"),
                Type.integer(1n),
                vars,
                false,
              ),
              Type.variablePattern("x"),
              vars,
            ),
          ],
          guards: [],
          body: (vars) => {
            return Erlang["+/2"](vars.x, vars.y);
          },
        },
      ],
      vars,
    );

    const result = Interpreter.callAnonymousFunction(anonFun, [
      Type.integer(1),
    ]);

    assert.deepStrictEqual(result, Type.integer(2));
  });

  it("errors raised inside function body are not caught", () => {
    const anonFun = Type.anonymousFunction(
      0,
      [
        {
          params: (_vars) => [],
          guards: [],
          body: (_vars) => Interpreter.raiseArgumentError("my message"),
        },
      ],
      vars,
    );

    assertBoxedError(
      () => Interpreter.callAnonymousFunction(anonFun, []),
      "ArgumentError",
      "my message",
    );
  });
});

it("callNamedFunction()", () => {
  // setup
  globalThis.Elixir_MyModule = {
    "my_fun/2": (arg1, arg2) => {
      return Erlang["+/2"](arg1, arg2);
    },
  };

  const alias = Type.alias("MyModule");
  const args = [Type.integer(1), Type.integer(2)];
  const result = Interpreter.callNamedFunction(alias, "my_fun/2", args);

  assert.deepStrictEqual(result, Type.integer(3));

  // cleanup
  delete globalThis.Elixir_MyModule;
});

describe("case()", () => {
  let vars;

  beforeEach(() => {
    vars = {a: Type.integer(5), b: Type.integer(6), x: Type.integer(9)};
  });

  it("returns the result of the first matching clause's block (and ignores non-matching clauses)", () => {
    // case 2 do
    //   1 -> :expr_1
    //   2 -> :expr_2
    //   3 -> :expr_3
    // end

    const clause1 = {
      match: Type.integer(1),
      guards: [],
      body: (_vars) => {
        return Type.atom("expr_1");
      },
    };

    const clause2 = {
      match: Type.integer(2),
      guards: [],
      body: (_vars) => {
        return Type.atom("expr_2");
      },
    };

    const clause3 = {
      match: Type.integer(3),
      guards: [],
      body: (_vars) => {
        return Type.atom("expr_3");
      },
    };

    const result = Interpreter.case(
      Type.integer(2),
      [clause1, clause2, clause3],
      vars,
    );

    assert.deepStrictEqual(result, Type.atom("expr_2"));
  });

  it("runs guards for each tried clause", () => {
    // case 2 do
    //   x when x == 1 -> :expr_1
    //   y when y == 2 -> :expr_2
    //   z when z == 3 -> :expr_3
    // end
    //
    // case 2 do
    //   x when :erlang.==(x, 1) -> :expr_1
    //   y when :erlang.==(y, 2) -> :expr_2
    //   z when :erlang.==(z, 3) -> :expr_3
    // end

    const clause1 = {
      match: Type.variablePattern("x"),
      guards: [(vars) => Erlang["==/2"](vars.x, Type.integer(1))],
      body: (_vars) => {
        return Type.atom("expr_1");
      },
    };

    const clause2 = {
      match: Type.variablePattern("y"),
      guards: [(vars) => Erlang["==/2"](vars.y, Type.integer(2))],
      body: (_vars) => {
        return Type.atom("expr_2");
      },
    };

    const clause3 = {
      match: Type.variablePattern("z"),
      guards: [(vars) => Erlang["==/2"](vars.z, Type.integer(3))],
      body: (_vars) => {
        return Type.atom("expr_3");
      },
    };

    const result = Interpreter.case(
      Type.integer(2),
      [clause1, clause2, clause3],
      vars,
    );

    assert.deepStrictEqual(result, Type.atom("expr_2"));
  });

  it("clause with multiple guards", () => {
    // case my_var do
    //   x when x == 1 when x == 11 -> :expr_1
    //   y when y == 2 when y == 22 -> :expr_2
    //   z when z == 3 when z == 33 -> :expr_3
    // end
    //
    // case my_var do
    //   x when :erlang.==(x, 1) when :erlang.==(x, 11) -> :expr_1
    //   y when :erlang.==(y, 2) when :erlang.==(y, 22) -> :expr_2
    //   z when :erlang.==(z, 3) when :erlang.==(z, 33) -> :expr_3
    // end

    const clause1 = {
      match: Type.variablePattern("x"),
      guards: [
        (vars) => Erlang["==/2"](vars.x, Type.integer(1)),
        (vars) => Erlang["==/2"](vars.x, Type.integer(11)),
      ],
      body: (_vars) => {
        return Type.atom("expr_1");
      },
    };

    const clause2 = {
      match: Type.variablePattern("y"),
      guards: [
        (vars) => Erlang["==/2"](vars.y, Type.integer(2)),
        (vars) => Erlang["==/2"](vars.y, Type.integer(22)),
      ],
      body: (_vars) => {
        return Type.atom("expr_2");
      },
    };

    const clause3 = {
      match: Type.variablePattern("z"),
      guards: [
        (vars) => Erlang["==/2"](vars.z, Type.integer(3)),
        (vars) => Erlang["==/2"](vars.z, Type.integer(33)),
      ],
      body: (_vars) => {
        return Type.atom("expr_3");
      },
    };

    const vars = {my_var: Type.integer(22)};

    const result = Interpreter.case(
      vars.my_var,
      [clause1, clause2, clause3],
      vars,
    );

    assert.deepStrictEqual(result, Type.atom("expr_2"));
  });

  it("clones vars for each clause and has access to vars from closure", () => {
    // x = 9
    //
    // case 2 do
    //   x when x == 1 -> :expr_1
    //   y -> x
    // end

    const clause1 = {
      match: Type.variablePattern("x"),
      guards: [(vars) => Erlang["==/2"](vars.x, Type.integer(1))],
      body: (_vars) => {
        return Type.atom("expr_1");
      },
    };

    const clause2 = {
      match: Type.variablePattern("y"),
      guards: [],
      body: (vars) => {
        return vars.x;
      },
    };

    const result = Interpreter.case(Type.integer(2), [clause1, clause2], vars);

    assert.deepStrictEqual(result, Type.integer(9));
  });

  it("raises CaseClauseError error if none of the clauses is matched", () => {
    // case 3 do
    //   1 -> :expr_1
    //   2 -> :expr_2
    // end

    const clause1 = {
      match: Type.integer(1),
      guards: [],
      body: (_vars) => {
        return Type.atom("expr_1");
      },
    };

    const clause2 = {
      match: Type.integer(2),
      guards: [],
      body: (_vars) => {
        return Type.atom("expr_2");
      },
    };

    assertBoxedError(
      () => Interpreter.case(Type.integer(3), [clause1, clause2], vars),
      "CaseClauseError",
      "no case clause matching: 3",
    );
  });

  it("errors raised inside case clause are not caught", () => {
    const clause = {
      match: Type.integer(1),
      guards: [],
      body: (_vars) => Interpreter.raiseArgumentError("my message"),
    };

    assertBoxedError(
      () => Interpreter.case(Type.integer(1), [clause], vars),
      "ArgumentError",
      "my message",
    );
  });

  it("mutliple-expression condition that is matched by one of the clauses", () => {
    // case (1; 2) do
    //   2 -> :ok
    // end
    const result = Interpreter.case(
      (_vars) => {
        Type.integer(1);
        return Type.integer(2);
      },
      [
        {
          match: Type.integer(2),
          guards: [],
          body: (_vars) => {
            return Type.atom("ok");
          },
        },
      ],
      vars,
    );

    assert.deepStrictEqual(result, Type.atom("ok"));
  });

  it("mutliple-expression condition that is not matched by any of the clauses", () => {
    const condition = (_vars) => {
      Type.integer(1);
      return Type.integer(2);
    };

    const clauses = [
      {
        match: Type.integer(1),
        guards: [],
        body: (_vars) => {
          return Type.atom("ok");
        },
      },
    ];

    assertBoxedError(
      // case (1; 2) do
      //   1 -> :ok
      // end
      () => Interpreter.case(condition, clauses, vars),
      "CaseClauseError",
      "no case clause matching: 2",
    );
  });

  it("clauses have access to vars from condition", () => {
    // (case x = 1; 2) do
    //   2 -> x
    // end
    const result = Interpreter.case(
      (vars) => {
        Interpreter.matchOperator(
          Type.integer(1),
          Type.variablePattern("x"),
          vars,
        );
        return Type.integer(2);
      },
      [
        {
          match: Type.integer(2),
          guards: [],
          body: (vars) => {
            return vars.x;
          },
        },
      ],
      vars,
    );

    assert.deepStrictEqual(result, Type.integer(1));
  });
});

describe("cloneVars()", () => {
  it("clones vars recursively (deep clone)", () => {
    const nested = {c: 3, d: 4};
    const vars = {a: 1, b: nested};
    const expected = {a: 1, b: nested};
    const result = Interpreter.cloneVars(vars);

    assert.deepStrictEqual(result, expected);
    assert.notEqual(result.b, nested);
  });
});

describe("comprehension()", () => {
  let vars, prevIntoFun, prevToListFun;

  beforeEach(() => {
    vars = {a: Type.integer(1), b: Type.integer(2)};

    prevIntoFun = globalThis.Elixir_Enum["into/2"];

    globalThis.Elixir_Enum["into/2"] = (enumerable, _collectable) => {
      return enumerable;
    };

    prevToListFun = globalThis.Elixir_Enum["to_list/1"];

    globalThis.Elixir_Enum["to_list/1"] = (enumerable) => {
      return enumerable;
    };
  });

  afterEach(() => {
    globalThis.Elixir_Enum["into/2"] = prevIntoFun;
    globalThis.Elixir_Enum["to_list/1"] = prevToListFun;
  });

  describe("generator", () => {
    it("generates combinations of enumerables items", () => {
      // for x <- [1, 2], y <- [3, 4], do: {x, y}

      const generator1 = {
        match: Type.variablePattern("x"),
        guards: [],
        body: (_vars) => Type.list([Type.integer(1), Type.integer(2)]),
      };

      const generator2 = {
        match: Type.variablePattern("y"),
        guards: [],
        body: (_vars) => Type.list([Type.integer(3), Type.integer(4)]),
      };

      const result = Interpreter.comprehension(
        [generator1, generator2],
        [],
        Type.map([]),
        false,
        (vars) => Type.tuple([vars.x, vars.y]),
        vars,
      );

      const expected = Type.list([
        Type.tuple([Type.integer(1), Type.integer(3)]),
        Type.tuple([Type.integer(1), Type.integer(4)]),
        Type.tuple([Type.integer(2), Type.integer(3)]),
        Type.tuple([Type.integer(2), Type.integer(4)]),
      ]);

      assert.deepStrictEqual(result, expected);
    });

    it("ignores enumerable items that don't match the pattern", () => {
      // for {11, x} <- [1, {11, 2}, 3, {11, 4}],
      //     {12, y} <- [5, {12, 6}, 7, {12, 8}],
      //     do: {x, y}

      const enumerable1 = (_vars) =>
        Type.list([
          Type.integer(1),
          Type.tuple([Type.integer(11), Type.integer(2)]),
          Type.integer(3),
          Type.tuple([Type.integer(11), Type.integer(4)]),
        ]);

      const generator1 = {
        match: Type.tuple([Type.integer(11), Type.variablePattern("x")]),
        guards: [],
        body: enumerable1,
      };

      const enumerable2 = (_vars) =>
        Type.list([
          Type.integer(5),
          Type.tuple([Type.integer(12), Type.integer(6)]),
          Type.integer(7),
          Type.tuple([Type.integer(12), Type.integer(8)]),
        ]);

      const generator2 = {
        match: Type.tuple([Type.integer(12), Type.variablePattern("y")]),
        guards: [],
        body: enumerable2,
      };

      const result = Interpreter.comprehension(
        [generator1, generator2],
        [],
        Type.list([]),
        false,
        (vars) => Type.tuple([vars.x, vars.y]),
        vars,
      );

      const expected = Type.list([
        Type.tuple([Type.integer(2), Type.integer(6)]),
        Type.tuple([Type.integer(2), Type.integer(8)]),
        Type.tuple([Type.integer(4), Type.integer(6)]),
        Type.tuple([Type.integer(4), Type.integer(8)]),
      ]);

      assert.deepStrictEqual(result, expected);
    });

    it("uses Enum.to_list/1 to convert generator enumerables to lists", () => {
      // for x <- [1, 2], y <- [3, 4], do: {x, y}

      const enumerable1 = (_vars) =>
        Type.list([Type.integer(1), Type.integer(2)]);

      const generator1 = {
        match: Type.variablePattern("x"),
        guards: [],
        body: enumerable1,
      };

      const enumerable2 = (_vars) =>
        Type.list([Type.integer(3), Type.integer(4)]);

      const generator2 = {
        match: Type.variablePattern("y"),
        guards: [],
        body: enumerable2,
      };

      const stub = sinon
        .stub(Elixir_Enum, "to_list/1")
        .callsFake((enumerable) => enumerable);

      Interpreter.comprehension(
        [generator1, generator2],
        [],
        Type.map([]),
        false,
        (vars) => Type.tuple([vars.x, vars.y]),
        vars,
      );

      sinon.assert.calledWith(stub, enumerable1(vars));
      sinon.assert.calledWith(stub, enumerable2(vars));
    });
  });

  describe("guards", () => {
    it("single guard", () => {
      // for x when x != 2 <- [1, 2, 3],
      //     y when y != 4 <- [4, 5, 6],
      //     do: {x, y}
      //
      // for x when :erlang."/="(x, 2) <- [1, 2, 3],
      //     y when :erlang."/="(y, 4) <- [4, 5, 6],
      //     do: {x, y}

      const enumerable1 = (_vars) =>
        Type.list([Type.integer(1), Type.integer(2), Type.integer(3)]);

      const guard1a = (vars) => Erlang["/=/2"](vars.x, Type.integer(2));

      const generator1 = {
        match: Type.variablePattern("x"),
        guards: [guard1a],
        body: enumerable1,
      };

      const enumerable2 = (_vars) =>
        Type.list([Type.integer(4), Type.integer(5), Type.integer(6)]);

      const guard2a = (vars) => Erlang["/=/2"](vars.y, Type.integer(4));

      const generator2 = {
        match: Type.variablePattern("y"),
        guards: [guard2a],
        body: enumerable2,
      };

      const result = Interpreter.comprehension(
        [generator1, generator2],
        [],
        Type.list([]),
        false,
        (vars) => Type.tuple([vars.x, vars.y]),
        vars,
      );

      const expected = Type.list([
        Type.tuple([Type.integer(1), Type.integer(5)]),
        Type.tuple([Type.integer(1), Type.integer(6)]),
        Type.tuple([Type.integer(3), Type.integer(5)]),
        Type.tuple([Type.integer(3), Type.integer(6)]),
      ]);

      assert.deepStrictEqual(result, expected);
    });

    it("multiple guards", () => {
      // for x when x == 2 when x == 4 <- [1, 2, 3, 4],
      //     y when y == 5 when y == 7 <- [5, 6, 7, 8],
      //     do: {x, y}
      //
      // for x when :erlang."=="(x, 2) when :erlang."=="(x, 4) <- [1, 2, 3, 4],
      //     y when :erlang."=="(y, 5) when :erlang."=="(y, 7) <- [5, 6, 7, 8],
      //     do: {x, y}

      const enumerable1 = (_vars) =>
        Type.list([
          Type.integer(1),
          Type.integer(2),
          Type.integer(3),
          Type.integer(4),
        ]);

      const guard1a = (vars) => Erlang["==/2"](vars.x, Type.integer(2));
      const guard1b = (vars) => Erlang["==/2"](vars.x, Type.integer(4));

      const generator1 = {
        match: Type.variablePattern("x"),
        guards: [guard1a, guard1b],
        body: enumerable1,
      };

      const enumerable2 = (_vars) =>
        Type.list([
          Type.integer(5),
          Type.integer(6),
          Type.integer(7),
          Type.integer(8),
        ]);

      const guard2a = (vars) => Erlang["==/2"](vars.y, Type.integer(5));
      const guard2b = (vars) => Erlang["==/2"](vars.y, Type.integer(7));

      const generator2 = {
        match: Type.variablePattern("y"),
        guards: [guard2a, guard2b],
        body: enumerable2,
      };

      const result = Interpreter.comprehension(
        [generator1, generator2],
        [],
        Type.list([]),
        false,
        (vars) => Type.tuple([vars.x, vars.y]),
        vars,
      );

      const expected = Type.list([
        Type.tuple([Type.integer(2), Type.integer(5)]),
        Type.tuple([Type.integer(2), Type.integer(7)]),
        Type.tuple([Type.integer(4), Type.integer(5)]),
        Type.tuple([Type.integer(4), Type.integer(7)]),
      ]);

      assert.deepStrictEqual(result, expected);
    });

    it("can access variables from comprehension outer scope", () => {
      // for x when x != b <- [1, 2, 3], do: x

      const enumerable = (_vars) =>
        Type.list([Type.integer(1), Type.integer(2), Type.integer(3)]);

      const guard = (vars) => Erlang["/=/2"](vars.x, vars.b);

      const generator = {
        match: Type.variablePattern("x"),
        guards: [guard],
        body: enumerable,
      };

      const result = Interpreter.comprehension(
        [generator],
        [],
        Type.list([]),
        false,
        (vars) => vars.x,
        vars,
      );

      const expected = Type.list([Type.integer(1), Type.integer(3)]);

      assert.deepStrictEqual(result, expected);
    });

    it("can access variables pattern matched in preceding guards", () => {
      // for x <- [1, 2], y when x != 1 <- [3, 4], do: {x, y}

      const enumerable1 = (_vars) =>
        Type.list([Type.integer(1), Type.integer(2)]);

      const generator1 = {
        match: Type.variablePattern("x"),
        guards: [],
        body: enumerable1,
      };

      const enumerable2 = (_vars) =>
        Type.list([Type.integer(3), Type.integer(4)]);

      const guard2 = (vars) => Erlang["/=/2"](vars.x, Type.integer(1));

      const generator2 = {
        match: Type.variablePattern("y"),
        guards: [guard2],
        body: enumerable2,
      };

      const result = Interpreter.comprehension(
        [generator1, generator2],
        [],
        Type.list([]),
        false,
        (vars) => Type.tuple([vars.x, vars.y]),
        vars,
      );

      const expected = Type.list([
        Type.tuple([Type.integer(2), Type.integer(3)]),
        Type.tuple([Type.integer(2), Type.integer(4)]),
      ]);

      assert.deepStrictEqual(result, expected);
    });

    it("errors raised inside generators are not caught", () => {
      const enumerable = (_vars) =>
        Type.list([Type.integer(1), Type.integer(2), Type.integer(3)]);

      const guard = (_vars) => Interpreter.raiseArgumentError("my message");

      const generator = {
        match: Type.variablePattern("x"),
        guards: [guard],
        body: enumerable,
      };

      assertBoxedError(
        () =>
          Interpreter.comprehension(
            [generator],
            [],
            Type.list([]),
            false,
            (vars) => vars.x,
            vars,
          ),
        "ArgumentError",
        "my message",
      );
    });
  });

  describe("filters", () => {
    it("remove combinations that don't fullfill specified conditions", () => {
      // for x <- [1, 2, 3],
      //     y <- [4, 5, 6],
      //     x + y < 8,
      //     y - x > 2,
      //     do: {x, y}

      // for x <- [1, 2, 3],
      //     y <- [4, 5, 6],
      //     :erlang.<(:erlang.+(x, y), 8),
      //     :erlang.>(:erlang.-(y, x), 2),
      //     do: {x, y}

      const enumerable1 = (_vars) =>
        Type.list([Type.integer(1), Type.integer(2), Type.integer(3)]);

      const generator1 = {
        match: Type.variablePattern("x"),
        guards: [],
        body: enumerable1,
      };

      const enumerable2 = (_vars) =>
        Type.list([Type.integer(4), Type.integer(5), Type.integer(6)]);

      const generator2 = {
        match: Type.variablePattern("y"),
        guards: [],
        body: enumerable2,
      };

      const filters = [
        (vars) => Erlang["</2"](Erlang["+/2"](vars.x, vars.y), Type.integer(8)),
        (vars) => Erlang[">/2"](Erlang["-/2"](vars.y, vars.x), Type.integer(2)),
      ];

      const result = Interpreter.comprehension(
        [generator1, generator2],
        filters,
        Type.list([]),
        false,
        (vars) => Type.tuple([vars.x, vars.y]),
        vars,
      );

      const expected = Type.list([
        Type.tuple([Type.integer(1), Type.integer(4)]),
        Type.tuple([Type.integer(1), Type.integer(5)]),
        Type.tuple([Type.integer(1), Type.integer(6)]),
        Type.tuple([Type.integer(2), Type.integer(5)]),
      ]);

      assert.deepStrictEqual(result, expected);
    });

    it("can access variables from comprehension outer scope", () => {
      // for x <- [1, 2, 3], x != b, do: x

      const enumerable = (_vars) =>
        Type.list([Type.integer(1), Type.integer(2), Type.integer(3)]);

      const generator = {
        match: Type.variablePattern("x"),
        guards: [],
        body: enumerable,
      };

      const filter = (vars) => Erlang["/=/2"](vars.x, vars.b);

      const result = Interpreter.comprehension(
        [generator],
        [filter],
        Type.list([]),
        false,
        (vars) => vars.x,
        vars,
      );

      const expected = Type.list([Type.integer(1), Type.integer(3)]);

      assert.deepStrictEqual(result, expected);
    });
  });

  describe("unique", () => {
    it("non-unique items are removed if 'uniq' option is set to true", () => {
      // for x <- [1, 2, 1], y <- [3, 4, 3], do: {x, y}

      const enumerable1 = (_vars) =>
        Type.list([Type.integer(1), Type.integer(2), Type.integer(1)]);

      const generator1 = {
        match: Type.variablePattern("x"),
        guards: [],
        body: enumerable1,
      };

      const enumerable2 = (_vars) =>
        Type.list([Type.integer(3), Type.integer(4), Type.integer(3)]);

      const generator2 = {
        match: Type.variablePattern("y"),
        guards: [],
        body: enumerable2,
      };

      const result = Interpreter.comprehension(
        [generator1, generator2],
        [],
        Type.list([]),
        true,
        (vars) => Type.tuple([vars.x, vars.y]),
        vars,
      );

      const expected = Type.list([
        Type.tuple([Type.integer(1), Type.integer(3)]),
        Type.tuple([Type.integer(1), Type.integer(4)]),
        Type.tuple([Type.integer(2), Type.integer(3)]),
        Type.tuple([Type.integer(2), Type.integer(4)]),
      ]);

      assert.deepStrictEqual(result, expected);
    });
  });

  describe("mapper", () => {
    it("can access variables from comprehension outer scope", () => {
      // for x <- [1, 2], do: {x, b}

      const enumerable = (_vars) =>
        Type.list([Type.integer(1), Type.integer(2)]);

      const generator = {
        match: Type.variablePattern("x"),
        guards: [],
        body: enumerable,
      };

      const result = Interpreter.comprehension(
        [generator],
        [],
        Type.list([]),
        false,
        (vars) => Type.tuple([vars.x, vars.b]),
        vars,
      );

      const expected = Type.list([
        Type.tuple([Type.integer(1), Type.integer(2)]),
        Type.tuple([Type.integer(2), Type.integer(2)]),
      ]);

      assert.deepStrictEqual(result, expected);
    });

    it("uses Enum.into/2 to insert the comprehension result into a collectable", () => {
      // for x <- [1, 2], y <- [3, 4], do: {x, y}

      const enumerable1 = (_vars) =>
        Type.list([Type.integer(1), Type.integer(2)]);

      const generator1 = {
        match: Type.variablePattern("x"),
        guards: [],
        body: enumerable1,
      };

      const enumerable2 = (_vars) =>
        Type.list([Type.integer(3), Type.integer(4)]);

      const generator2 = {
        match: Type.variablePattern("y"),
        guards: [],
        body: enumerable2,
      };

      const stub = sinon
        .stub(Elixir_Enum, "into/2")
        .callsFake((enumerable, _collectable) => enumerable);

      Interpreter.comprehension(
        [generator1, generator2],
        [],
        Type.map([]),
        false,
        (vars) => Type.tuple([vars.x, vars.y]),
        vars,
      );

      const expectedArg = Type.list([
        Type.tuple([Type.integer(1), Type.integer(3)]),
        Type.tuple([Type.integer(1), Type.integer(4)]),
        Type.tuple([Type.integer(2), Type.integer(3)]),
        Type.tuple([Type.integer(2), Type.integer(4)]),
      ]);

      assert.isTrue(stub.calledOnceWith(expectedArg));
    });
  });
});

describe("cond()", () => {
  let vars;

  beforeEach(() => {
    vars = {a: Type.integer(5), b: Type.integer(6), x: Type.integer(9)};
  });

  it("returns the result of the block of the first clause whose condition evaluates to a truthy value (and ignores other clauses)", () => {
    // cond do
    //   nil -> :expr_1
    //   2 -> :expr_2
    //   3 -> :expr_3
    // end

    const clause1 = {
      condition: (_vars) => Type.nil(),
      body: (_vars) => {
        return Type.atom("expr_1");
      },
    };

    const clause2 = {
      condition: (_vars) => Type.integer(2),
      body: (_vars) => {
        return Type.atom("expr_2");
      },
    };

    const clause3 = {
      condition: (_vars) => Type.integer(3),
      body: (_vars) => {
        return Type.atom("expr_3");
      },
    };

    const result = Interpreter.cond([clause1, clause2, clause3], vars);

    assert.deepStrictEqual(result, Type.atom("expr_2"));
  });

  it("clones vars for each clause and has access to vars from closure", () => {
    // x = 9
    //
    // cond do
    //   x = false -> :expr_1
    //   true -> x
    // end

    const clause1 = {
      condition: (vars) =>
        Interpreter.matchOperator(
          Type.boolean(false),
          Type.variablePattern("x"),
          vars,
        ),
      body: (_vars) => {
        return Type.atom("expr_1");
      },
    };

    const clause2 = {
      condition: (_vars) => Type.boolean(true),
      body: (vars) => {
        return vars.x;
      },
    };

    const result = Interpreter.cond([clause1, clause2], vars);

    assert.deepStrictEqual(result, Type.integer(9));
  });

  it("raises CaseClauseError error if none of the clauses conditions evaluate to a truthy value", () => {
    // cond do
    //   nil -> :expr_1
    //   false -> :expr_2
    // end

    const clause1 = {
      condition: (_vars) => Type.nil(),
      body: (_vars) => {
        return Type.atom("expr_1");
      },
    };

    const clause2 = {
      condition: (_vars) => Type.boolean(false),
      body: (_vars) => {
        return Type.atom("expr_2");
      },
    };

    assertBoxedError(
      () => Interpreter.cond([clause1, clause2], vars),
      "CondClauseError",
      "no cond clause evaluated to a truthy value",
    );
  });
});

describe("consOperator()", () => {
  it("constructs a proper list when the tail param is a proper non-empty list", () => {
    const head = Type.integer(1);
    const tail = Type.list([Type.integer(2), Type.integer(3)]);
    const result = Interpreter.consOperator(head, tail);

    const expected = Type.list([
      Type.integer(1),
      Type.integer(2),
      Type.integer(3),
    ]);

    assert.deepStrictEqual(result, expected);
  });

  it("constructs a proper list when the tail param is an empty list", () => {
    const head = Type.integer(1);
    const tail = Type.list([]);
    const result = Interpreter.consOperator(head, tail);
    const expected = Type.list([Type.integer(1)]);

    assert.deepStrictEqual(result, expected);
  });

  it("constructs improper list when the tail is not a list", () => {
    const head = Type.integer(1);
    const tail = Type.atom("abc");
    const result = Interpreter.consOperator(head, tail);
    const expected = Type.improperList([Type.integer(1), Type.atom("abc")]);

    assert.deepStrictEqual(result, expected);
  });
});

describe("defineElixirFunction()", () => {
  beforeEach(() => {
    // def my_fun_a(1), do: :expr_1
    // def my_fun_a(2), do: :expr_2
    Interpreter.defineElixirFunction("Elixir_Aaa_Bbb", "my_fun_a", 1, [
      {
        params: (_vars) => [Type.integer(1)],
        guards: [],
        body: (_vars) => {
          return Type.atom("expr_1");
        },
      },
      {
        params: (_vars) => [Type.integer(2)],
        guards: [],
        body: (_vars) => {
          return Type.atom("expr_2");
        },
      },
    ]);
  });

  afterEach(() => {
    delete globalThis.Elixir_Aaa_Bbb;
  });

  it("initiates the module global var if it is not initiated yet", () => {
    Interpreter.defineElixirFunction("Elixir_Ddd", "my_fun_d", 4, []);

    assert.isDefined(globalThis.Elixir_Ddd);
    assert.isDefined(globalThis.Elixir_Ddd["my_fun_d/4"]);

    // cleanup
    delete globalThis.Elixir_Ddd;
  });

  it("appends to the module global var if it is already initiated", () => {
    globalThis.Elixir_Eee = {"dummy/1": "dummy_body"};
    Interpreter.defineElixirFunction("Elixir_Eee", "my_fun_e", 5, []);

    assert.isDefined(globalThis.Elixir_Eee);
    assert.isDefined(globalThis.Elixir_Eee["my_fun_e/5"]);
    assert.equal(globalThis.Elixir_Eee["dummy/1"], "dummy_body");

    // cleanup
    delete globalThis.Elixir_Eee;
  });

  it("defines function with multiple params", () => {
    // def my_fun_e(1, 2, 3), do: :ok
    Interpreter.defineElixirFunction("Elixir_Aaa_Bbb", "my_fun_e", 3, [
      {
        params: (_vars) => [Type.integer(1), Type.integer(2), Type.integer(3)],
        guards: [],
        body: (_vars) => {
          return Type.atom("ok");
        },
      },
    ]);

    const result = globalThis.Elixir_Aaa_Bbb["my_fun_e/3"](
      Type.integer(1),
      Type.integer(2),
      Type.integer(3),
    );

    assert.deepStrictEqual(result, Type.atom("ok"));
  });

  it("defines function which runs the first matching clause", () => {
    const result = globalThis.Elixir_Aaa_Bbb["my_fun_a/1"](Type.integer(1));
    assert.deepStrictEqual(result, Type.atom("expr_1"));
  });

  it("defines function which ignores not matching clauses", () => {
    const result = globalThis.Elixir_Aaa_Bbb["my_fun_a/1"](Type.integer(2));
    assert.deepStrictEqual(result, Type.atom("expr_2"));
  });

  it("defines function which runs guards for each tried clause", () => {
    // def my_fun_b(x) when x == 1, do: :expr_1
    // def my_fun_b(y) when y == 2, do: :expr_2
    // def my_fun_b(z) when z == 3, do: :expr_3
    Interpreter.defineElixirFunction("Elixir_Aaa_Bbb", "my_fun_b", 1, [
      {
        params: (_vars) => [Type.variablePattern("x")],
        guards: [(vars) => Erlang["==/2"](vars.x, Type.integer(1))],
        body: (_vars) => {
          return Type.atom("expr_1");
        },
      },
      {
        params: (_vars) => [Type.variablePattern("y")],
        guards: [(vars) => Erlang["==/2"](vars.y, Type.integer(2))],
        body: (_vars) => {
          return Type.atom("expr_2");
        },
      },
      {
        params: (_vars) => [Type.variablePattern("z")],
        guards: [(vars) => Erlang["==/2"](vars.z, Type.integer(3))],
        body: (_vars) => {
          return Type.atom("expr_3");
        },
      },
    ]);

    const result = globalThis.Elixir_Aaa_Bbb["my_fun_b/1"](Type.integer(3));

    assert.deepStrictEqual(result, Type.atom("expr_3"));
  });

  it("defines function with multiple guards", () => {
    // def my_fun_b(x) when x == 1 when x == 2, do: x
    //
    // def my_fun_b(x) when :erlang.==(x, 1) when :erlang.==(x, 2), do: x
    Interpreter.defineElixirFunction("Elixir_Aaa_Bbb", "my_fun_b", 1, [
      {
        params: (_vars) => [Type.variablePattern("x")],
        guards: [
          (vars) => Erlang["==/2"](vars.x, Type.integer(1)),
          (vars) => Erlang["==/2"](vars.x, Type.integer(2)),
        ],
        body: (vars) => {
          return vars.x;
        },
      },
    ]);

    const result1 = globalThis.Elixir_Aaa_Bbb["my_fun_b/1"](Type.integer(1));
    assert.deepStrictEqual(result1, Type.integer(1));

    const result2 = globalThis.Elixir_Aaa_Bbb["my_fun_b/1"](Type.integer(2));
    assert.deepStrictEqual(result2, Type.integer(2));

    assertBoxedError(
      () => globalThis.Elixir_Aaa_Bbb["my_fun_b/1"](Type.integer(3)),
      "FunctionClauseError",
      "no function clause matching in Aaa.Bbb.my_fun_b/1",
    );
  });

  it("defines function which clones vars for each clause", () => {
    // def my_fun_c(x) when x == 1, do: :expr_1
    // def my_fun_c(x) when x == 2, do: :expr_2
    Interpreter.defineElixirFunction("Elixir_Aaa_Bbb", "my_fun_c", 1, [
      {
        params: (_vars) => [Type.variablePattern("x")],
        guards: [(vars) => Erlang["==/2"](vars.x, Type.integer(1))],
        body: (_vars) => {
          return Type.atom("expr_1");
        },
      },
      {
        params: (_vars) => [Type.variablePattern("x")],
        guards: [(vars) => Erlang["==/2"](vars.x, Type.integer(2))],
        body: (_vars) => {
          return Type.atom("expr_2");
        },
      },
    ]);

    const result = globalThis.Elixir_Aaa_Bbb["my_fun_c/1"](Type.integer(2));

    assert.deepStrictEqual(result, Type.atom("expr_2"));
  });

  it("raises FunctionClauseError if there are no matching clauses", () => {
    assertBoxedError(
      () => globalThis.Elixir_Aaa_Bbb["my_fun_a/1"](Type.integer(3)),
      "FunctionClauseError",
      "no function clause matching in Aaa.Bbb.my_fun_a/1",
    );
  });

  it("defines function which has match operator in params", () => {
    // def my_fun_d(x = 1 = y), do: x + y
    Interpreter.defineElixirFunction("Elixir_Aaa_Bbb", "my_fun_d", 1, [
      {
        params: (vars) => [
          Interpreter.matchOperator(
            Interpreter.matchOperator(
              Type.variablePattern("y"),
              Type.integer(1),
              vars,
              false,
            ),
            Type.variablePattern("x"),
            vars,
          ),
        ],
        guards: [],
        body: (vars) => {
          return Erlang["+/2"](vars.x, vars.y);
        },
      },
    ]);

    const result = globalThis.Elixir_Aaa_Bbb["my_fun_d/1"](Type.integer(1));

    assert.deepStrictEqual(result, Type.integer(2));
  });

  it("errors raised inside function body are not caught", () => {
    Interpreter.defineElixirFunction("Elixir_Aaa_Bbb", "my_fun_f", 0, [
      {
        params: () => [],
        guards: [],
        body: (_vars) => Interpreter.raiseArgumentError("my message"),
      },
    ]);

    assertBoxedError(
      () => globalThis.Elixir_Aaa_Bbb["my_fun_f/0"](),
      "ArgumentError",
      "my message",
    );
  });

  it("raises HologramInterpreterError when undefined function is being accessed", () => {
    assert.throw(
      () => Elixir_Aaa_Bbb["my_fun_x/5"],
      HologramInterpreterError,
      "Function Aaa.Bbb.my_fun_x/5 is not available on the client. See what to do here: https://www.hologram.page/TODO",
    );
  });
});

describe("defineErlangFunction()", () => {
  beforeEach(() => {
    Interpreter.defineErlangFunction("Erlang_Aaa_Bbb", "my_fun_a", 2, () =>
      Type.atom("expr_a"),
    );
  });

  afterEach(() => {
    delete globalThis.Erlang_Aaa_Bbb;
  });

  it("initiates the module global var if it is not initiated yet", () => {
    Interpreter.defineErlangFunction("Erlang_Ddd", "my_fun_d", 3, []);

    assert.isDefined(globalThis.Erlang_Ddd);
    assert.isDefined(globalThis.Erlang_Ddd["my_fun_d/3"]);

    // cleanup
    delete globalThis.Erlang_Ddd;
  });

  it("appends to the module global var if it is already initiated", () => {
    globalThis.Erlang_Eee = {dummy: "dummy"};
    Interpreter.defineErlangFunction("Erlang_Eee", "my_fun_e", 1, []);

    assert.isDefined(globalThis.Erlang_Eee);
    assert.isDefined(globalThis.Erlang_Eee["my_fun_e/1"]);
    assert.equal(globalThis.Erlang_Eee.dummy, "dummy");

    // cleanup
    delete globalThis.Erlang_Eee;
  });

  it("defines function", () => {
    const result = globalThis.Erlang_Aaa_Bbb["my_fun_a/2"](Type.integer(1));
    assert.deepStrictEqual(result, Type.atom("expr_a"));
  });
});

describe("defineNotImplementedErlangFunction()", () => {
  beforeEach(() => {
    Interpreter.defineNotImplementedErlangFunction(
      "aaa_bbb",
      "Erlang_Aaa_Bbb",
      "my_fun_a",
      2,
    );
  });

  afterEach(() => {
    delete globalThis.Erlang_Aaa_Bbb;
  });

  it("initiates the module global var if it is not initiated yet", () => {
    Interpreter.defineNotImplementedErlangFunction(
      "ddd",
      "Erlang_Ddd",
      "my_fun_d",
      3,
      [],
    );

    assert.isDefined(globalThis.Erlang_Ddd);
    assert.isDefined(globalThis.Erlang_Ddd["my_fun_d/3"]);

    // cleanup
    delete globalThis.Erlang_Ddd;
  });

  it("appends to the module global var if it is already initiated", () => {
    globalThis.Erlang_Eee = {dummy: "dummy"};
    Interpreter.defineNotImplementedErlangFunction(
      "eee",
      "Erlang_Eee",
      "my_fun_e",
      1,
      [],
    );

    assert.isDefined(globalThis.Erlang_Eee);
    assert.isDefined(globalThis.Erlang_Eee["my_fun_e/1"]);
    assert.equal(globalThis.Erlang_Eee.dummy, "dummy");

    // cleanup
    delete globalThis.Erlang_Eee;
  });

  it("defines a function which raises an exception with instructions", () => {
    const expectedMessage = `Function :aaa_bbb.my_fun_a/2 is not yet ported. See what to do here: https://www.hologram.page/TODO`;

    assert.throw(
      () =>
        globalThis.Erlang_Aaa_Bbb["my_fun_a/2"](
          Type.integer(1),
          Type.integer(2),
        ),
      Error,
      expectedMessage,
    );
  });
});

describe("deserialize()", () => {
  it("deserializes number from JSON", () => {
    const result = Interpreter.deserialize("123");
    assert.equal(result, 123);
  });

  it("deserializes string from JSON", () => {
    const result = Interpreter.deserialize('"abc"');
    assert.equal(result, "abc");
  });

  it("deserializes non-negative bigint from JSON", () => {
    const result = Interpreter.deserialize('"__bigint__:123"');
    assert.equal(result, 123n);
  });

  it("deserializes negative bigint from JSON", () => {
    const result = Interpreter.deserialize('"__bigint__:-123"');
    assert.equal(result, -123n);
  });

  it("deserializes non-nested object from JSON", () => {
    const result = Interpreter.deserialize('{"a":1,"b":2}');
    assert.deepStrictEqual(result, {a: 1, b: 2});
  });

  it("deserializes nested object from JSON", () => {
    const result = Interpreter.deserialize('{"a":1,"b":2,"c":{"d":3,"e":4}}');
    const expected = {a: 1, b: 2, c: {d: 3, e: 4}};

    assert.deepStrictEqual(result, expected);
  });
});

describe("dotOperator()", () => {
  it("handles remote function call", () => {
    // setup
    globalThis.Elixir_MyModule = {
      "my_fun/0": () => {
        return Type.integer(123);
      },
    };

    const left = Type.alias("MyModule");
    const right = Type.atom("my_fun");
    const result = Interpreter.dotOperator(left, right);

    assert.deepStrictEqual(result, Type.integer(123));

    // cleanup
    delete globalThis.Elixir_MyModule;
  });

  it("handles map key access", () => {
    const key = Type.atom("b");
    const value = Type.integer(2);

    const left = Type.map([
      [Type.atom("a"), Type.integer(1)],
      [key, value],
    ]);

    const result = Interpreter.dotOperator(left, key);

    assert.deepStrictEqual(result, value);
  });
});

it("fetchErrorMessage()", () => {
  const errorStruct = Type.errorStruct("MyError", "my message");
  const jsError = new HologramBoxedError(errorStruct);
  const result = Interpreter.fetchErrorMessage(jsError);

  assert.equal(result, "my message");
});

it("fetchErrorType()", () => {
  const errorStruct = Type.errorStruct("MyError", "my message");
  const jsError = new HologramBoxedError(errorStruct);
  const result = Interpreter.fetchErrorType(jsError);

  assert.equal(result, "MyError");
});

// Important: keep Kernel.inspect/2 consistency tests in sync.
describe("inspect()", () => {
  describe("atom", () => {
    it("true", () => {
      const result = Interpreter.inspect(Type.boolean(true), {});
      assert.equal(result, "true");
    });

    it("false", () => {
      const result = Interpreter.inspect(Type.boolean(false), {});
      assert.equal(result, "false");
    });

    it("nil", () => {
      const result = Interpreter.inspect(Type.nil(), {});
      assert.equal(result, "nil");
    });

    it("non-boolean and non-nil", () => {
      const result = Interpreter.inspect(Type.atom("abc"), {});
      assert.equal(result, ":abc");
    });

    describe("bitstring", () => {
      it("empty text", () => {
        const result = Interpreter.inspect(Type.bitstring(""), {});
        assert.equal(result, '""');
      });

      it("ASCII text", () => {
        const result = Interpreter.inspect(Type.bitstring("abc"), {});
        assert.equal(result, '"abc"');
      });

      it("Unicode text", () => {
        const result = Interpreter.inspect(Type.bitstring("全息图"), {});
        assert.equal(result, '"全息图"');
      });

      // TODO: remove when all types are supported
      it("not text", () => {
        const result = Interpreter.inspect(Type.bitstring([1, 0, 1]), {});
        assert.equal(result, '{"type":"bitstring","bits":{"0":1,"1":0,"2":1}}');
      });
    });

    describe("float", () => {
      it("integer-representable", () => {
        const result = Interpreter.inspect(Type.float(123.0), {});
        assert.equal(result, "123.0");
      });

      it("not integer-representable", () => {
        const result = Interpreter.inspect(Type.float(123.45), {});
        assert.equal(result, "123.45");
      });
    });

    it("integer", () => {
      const result = Interpreter.inspect(Type.integer(123), {});
      assert.equal(result, "123");
    });

    describe("list", () => {
      it("empty", () => {
        const result = Interpreter.inspect(Type.list([]), {});
        assert.equal(result, "[]");
      });

      it("non-empty, proper", () => {
        const result = Interpreter.inspect(
          Type.list([Type.integer(1), Type.integer(2), Type.integer(3)]),
          {},
        );

        assert.equal(result, "[1, 2, 3]");
      });

      it("non-empty, improper", () => {
        const result = Interpreter.inspect(
          Type.improperList([
            Type.integer(1),
            Type.integer(2),
            Type.integer(3),
          ]),
          {},
        );

        assert.equal(result, "[1, 2 | 3]");
      });
    });

    describe("map", () => {
      it("empty", () => {
        const result = Interpreter.inspect(Type.map([]), {});
        assert.equal(result, "%{}");
      });

      it("non-empty, with atom keys", () => {
        const map = Type.map([
          [Type.atom("a"), Type.integer(1)],
          [Type.atom("b"), Type.bitstring("xyz")],
        ]);

        const result = Interpreter.inspect(map, {});

        assert.equal(result, '%{a: 1, b: "xyz"}');
      });

      it("non-empty, with non-atom keys", () => {
        const map = Type.map([
          [Type.integer(9), Type.bitstring("xyz")],
          [Type.bitstring("abc"), Type.float(2.3)],
        ]);

        const result = Interpreter.inspect(map, {});

        assert.equal(result, '%{9 => "xyz", "abc" => 2.3}');
      });
    });

    describe("string", () => {
      it("empty text", () => {
        const result = Interpreter.inspect(Type.string(""), {});
        assert.equal(result, '""');
      });

      it("ASCII text", () => {
        const result = Interpreter.inspect(Type.string("abc"), {});
        assert.equal(result, '"abc"');
      });
    });

    describe("tuple", () => {
      it("empty", () => {
        const result = Interpreter.inspect(Type.tuple([]), {});
        assert.equal(result, "{}");
      });

      it("non-empty", () => {
        const result = Interpreter.inspect(
          Type.tuple([Type.integer(1), Type.integer(2), Type.integer(3)]),
          {},
        );

        assert.equal(result, "{1, 2, 3}");
      });
    });
  });

  // TODO: remove when all types are supported
  it("default", () => {
    const result = Interpreter.inspect({type: "x"}, {});
    assert.equal(result, '{"type":"x"}');
  });
});

describe("inspectModuleName()", () => {
  it("inspects Elixir module name", () => {
    const result = Interpreter.inspectModuleName("Elixir_Aaa_Bbb");
    assert.deepStrictEqual(result, "Aaa.Bbb");
  });

  it("inspects 'Erlang' module name", () => {
    const result = Interpreter.inspectModuleName("Erlang");
    assert.deepStrictEqual(result, ":erlang");
  });

  it("inspects Erlang standard lib module name", () => {
    const result = Interpreter.inspectModuleName("Erlang_Uri_String");
    assert.deepStrictEqual(result, ":uri_string");
  });
});

describe("isEqual()", () => {
  // non-number == non-number
  it("returns true for a boxed non-number equal to another boxed non-number", () => {
    const left = Type.boolean(true);
    const right = Type.boolean(true);
    const result = Interpreter.isEqual(left, right);

    assert.isTrue(result);
  });

  // non-number != non-number
  it("returns false for a boxed non-number not equal to another boxed non-number", () => {
    const left = Type.boolean(true);
    const right = Type.bitstring("abc");
    const result = Interpreter.isEqual(left, right);

    assert.isFalse(result);
  });

  // integer == integer
  it("returns true for a boxed integer equal to another boxed integer", () => {
    const left = Type.integer(1);
    const right = Type.integer(1);
    const result = Interpreter.isEqual(left, right);

    assert.isTrue(result);
  });

  // integer != integer
  it("returns false for a boxed integer not equal to another boxed integer", () => {
    const left = Type.integer(1);
    const right = Type.integer(2);
    const result = Interpreter.isEqual(left, right);

    assert.isFalse(result);
  });

  // integer == float
  it("returns true for a boxed integer equal to a boxed float", () => {
    const left = Type.integer(1);
    const right = Type.float(1.0);
    const result = Interpreter.isEqual(left, right);

    assert.isTrue(result);
  });

  // integer != float
  it("returns false for a boxed integer not equal to a boxed float", () => {
    const left = Type.integer(1);
    const right = Type.float(2.0);
    const result = Interpreter.isEqual(left, right);

    assert.isFalse(result);
  });

  // integer != non-number
  it("returns false when a boxed integer is compared to a boxed value of non-number type", () => {
    const left = Type.integer(1);
    const right = Type.bitstring("1");
    const result = Interpreter.isEqual(left, right);

    assert.isFalse(result);
  });

  // float == float
  it("returns true for a boxed float equal to another boxed float", () => {
    const left = Type.float(1.0);
    const right = Type.float(1.0);
    const result = Interpreter.isEqual(left, right);

    assert.isTrue(result);
  });

  // float != float
  it("returns false for a boxed float not equal to another boxed float", () => {
    const left = Type.float(1.0);
    const right = Type.float(2.0);
    const result = Interpreter.isEqual(left, right);

    assert.isFalse(result);
  });

  // float == integer
  it("returns true for a boxed float equal to a boxed integer", () => {
    const left = Type.float(1.0);
    const right = Type.integer(1);
    const result = Interpreter.isEqual(left, right);

    assert.isTrue(result);
  });

  // float != integer
  it("returns false for a boxed float not equal to a boxed integer", () => {
    const left = Type.float(1.0);
    const right = Type.integer(2);
    const result = Interpreter.isEqual(left, right);

    assert.isFalse(result);
  });

  // float != non-number
  it("returns false when a boxed float is compared to a boxed value of non-number type", () => {
    const left = Type.float(1.0);
    const right = Type.bitstring("1.0");
    const result = Interpreter.isEqual(left, right);

    assert.isFalse(result);
  });
});

describe("isMatched()", () => {
  it("is matched", () => {
    assert.isTrue(Interpreter.isMatched(Type.integer(1), Type.integer(1), {}));
  });

  it("is not matched", () => {
    assert.isFalse(Interpreter.isMatched(Type.integer(1), Type.integer(2), {}));
  });

  it("adds matched vars to __matched__ field", () => {
    const vars = {};

    const result = Interpreter.isMatched(
      Type.variablePattern("x"),
      Type.integer(9),
      vars,
    );

    assert.isTrue(result);
    assert.deepStrictEqual(vars, {__matched__: {x: Type.integer(9)}});
  });
});

describe("isStrictlyEqual()", () => {
  it("returns true if the args are of the same boxed primitive type and have equal values", () => {
    const result = Interpreter.isStrictlyEqual(
      Type.integer(1),
      Type.integer(1),
    );

    assert.isTrue(result);
  });

  it("returns false if the args are not of the same boxed primitive type but have equal values", () => {
    const result = Interpreter.isStrictlyEqual(
      Type.integer(1),
      Type.float(1.0),
    );

    assert.isFalse(result);
  });

  it("returns true if the left boxed arg of a composite type is deeply equal to the right boxed arg of a composite type", () => {
    const left = Type.map([
      [Type.atom("a"), Type.integer(1)],
      [Type.atom("b"), Type.map([[Type.atom("c"), Type.integer(3)]])],
    ]);

    const right = Type.map([
      [Type.atom("a"), Type.integer(1)],
      [Type.atom("b"), Type.map([[Type.atom("c"), Type.integer(3)]])],
    ]);

    const result = Interpreter.isStrictlyEqual(left, right);

    assert.isTrue(result);
  });

  it("returns false if the left boxed arg of a composite type is not deeply equal to the right boxed arg of a composite type", () => {
    const left = Type.map([
      [Type.atom("a"), Type.integer(1)],
      [Type.atom("b"), Type.map([[Type.atom("c"), Type.integer(3)]])],
    ]);

    const right = Type.map([
      [Type.atom("a"), Type.integer(1)],
      [Type.atom("b"), Type.map([[Type.atom("c"), Type.integer(4)]])],
    ]);

    const result = Interpreter.isStrictlyEqual(left, right);

    assert.isFalse(result);
  });
});

// IMPORTANT!
// Each JavaScript test has a related Elixir consistency test in test/elixir/hologram/ex_js_consistency/match_operator_test.exs
// Always update both together.
//
// left and right args are not stored in temporary variables but used directly in matchOperator() call,
// to make the test as close as possible to real behaviour in which the matchOperator() call is encoded as a whole.
describe("matchOperator()", () => {
  const varsWithEmptyMatchedValues = {a: Type.integer(9), __matched__: {}};
  let vars;

  beforeEach(() => {
    vars = {a: Type.integer(9)};
  });

  describe("atom type", () => {
    // :abc = :abc
    it("left atom == right atom", () => {
      const result = Interpreter.matchOperator(
        Type.atom("abc"),
        Type.atom("abc"),
        vars,
      );

      assert.deepStrictEqual(result, Type.atom("abc"));
      assert.deepStrictEqual(vars, varsWithEmptyMatchedValues);
    });

    // :abc = :xyz
    it("left atom != right atom", () => {
      const myAtom = Type.atom("xyz");

      assertMatchError(
        () => Interpreter.matchOperator(myAtom, Type.atom("abc"), vars),
        myAtom,
      );
    });

    // :abc = 2
    it("left atom != right non-atom", () => {
      const myInteger = Type.integer(2);

      assertMatchError(
        () => Interpreter.matchOperator(myInteger, Type.atom("abc"), vars),
        myInteger,
      );
    });
  });

  describe("bitstring modifier, signed", () => {
    // <<value::signed>> = <<1::1, 0::1, 1::1, 0::1, 1::1, 0::1, 1::1, 0::1>>
    // The test would be the same as "integer type modifier", because the encoder always specifies the segment's type.
    // it("no type modifier")

    // <<value::binary-signed>> won't compile
    // it("binary type modifier")

    // <<value::bitstring-signed>> won't compile
    // it("bitstring type modifier")

    // <<value::float-size(64)-signed>> = <<123.45::size(64)>>
    it("float type modifier, 64-bit size modifier", () => {
      const left = Type.bitstringPattern([
        Type.bitstringSegment(Type.variablePattern("value"), {
          type: "float",
          size: Type.integer(64),
          signedness: "signed",
        }),
      ]);

      const right = Type.bitstring([
        Type.bitstringSegment(Type.float(123.45), {
          type: "float",
          size: Type.integer(64),
        }),
      ]);

      const result = Interpreter.matchOperator(right, left, vars);

      assert.deepStrictEqual(result, right);

      assert.deepStrictEqual(vars, {
        a: Type.integer(9),
        __matched__: {value: Type.float(123.45)},
      });
    });

    // <<value::float-size(32)-signed>> = <<123.45::size(32)>>
    it("float type modifier, 32-bit size modifier", () => {
      const left = Type.bitstringPattern([
        Type.bitstringSegment(Type.variablePattern("value"), {
          type: "float",
          size: Type.integer(32),
          signedness: "signed",
        }),
      ]);

      const right = Type.bitstring([
        Type.bitstringSegment(Type.float(123.45), {
          type: "float",
          size: Type.integer(32),
        }),
      ]);

      const result = Interpreter.matchOperator(right, left, vars);

      assert.deepStrictEqual(result, right);

      assert.deepStrictEqual(vars, {
        a: Type.integer(9),
        __matched__: {value: Type.float(123.44999694824219)},
      });
    });

    // TODO: update once 16-bit float bitstring segments are implemented in Hologram
    // <<value::float-size(16)-signed>> = <<123.45::size(16)>>
    it("float type modifier, 16-bit size modifier", () => {
      // const left = Type.bitstringPattern([
      //   Type.bitstringSegment(Type.variablePattern("value"), {
      //     type: "float",
      //     size: Type.integer(16),
      //     signedness: "signed",
      //   }),
      // ]);

      assert.throw(
        () =>
          Type.bitstring([
            Type.bitstringSegment(Type.float(123.45), {
              type: "float",
              size: Type.integer(16),
            }),
          ]),
        HologramInterpreterError,
        "16-bit float bitstring segments are not yet implemented in Hologram",
      );
    });

    // <<_value::float-size(size)-signed>> = <<1::1, 0::1, 1::1, 0::1, 1::1, 0::1, 1::1, 0::1>>
    it("float type modifier, unsupported size modifier", () => {
      const left = Type.bitstringPattern([
        Type.bitstringSegment(Type.variablePattern("value"), {
          type: "float",
          size: Type.integer(8),
          signedness: "signed",
        }),
      ]);

      // 170 == 0b10101010
      const right = Type.bitstring([1, 0, 1, 0, 1, 0, 1, 0]);

      assertMatchError(
        () => Interpreter.matchOperator(right, left, vars),
        right,
      );
    });

    // <<value::integer-signed>> = <<1::1, 0::1, 1::1, 0::1, 1::1, 0::1, 1::1, 0::1>>
    it("integer type modifier", () => {
      const left = Type.bitstringPattern([
        Type.bitstringSegment(Type.variablePattern("value"), {
          type: "integer",
          signedness: "signed",
        }),
      ]);

      // 170 == 0b10101010
      const right = Type.bitstring([1, 0, 1, 0, 1, 0, 1, 0]);

      const result = Interpreter.matchOperator(right, left, vars);

      assert.deepStrictEqual(result, right);

      assert.deepStrictEqual(vars, {
        a: Type.integer(9),
        __matched__: {value: Type.integer(-86)},
      });
    });

    // <value::utf8-signed>> won't compile
    // it("utf8 type modifier")

    // <value::utf16-signed>> won't compile
    // it("utf16 type modifier")

    // <value::utf32-signed>> won't compile
    // it("utf32 type modifier")
  });

  describe("bitstring modifier, unsigned", () => {
    // <<value::unsigned>> = <<1::1, 0::1, 1::1, 0::1, 1::1, 0::1, 1::1, 0::1>>
    // The test would be the same as "integer type modifier", because the encoder always specifies the segment's type.
    // it("no type modifier")

    // <<value::binary-unsigned>> won't compile
    // it("binary type modifier")

    // <<value::bitstring-unsigned>> won't compile
    // it("bitstring type modifier")

    // <<value::float-size(64)-unsigned>> = <<123.45::size(64)>>
    it("float type modifier, 64-bit size modifier", () => {
      const left = Type.bitstringPattern([
        Type.bitstringSegment(Type.variablePattern("value"), {
          type: "float",
          size: Type.integer(64),
          signedness: "unsigned",
        }),
      ]);

      const right = Type.bitstring([
        Type.bitstringSegment(Type.float(123.45), {
          type: "float",
          size: Type.integer(64),
        }),
      ]);

      const result = Interpreter.matchOperator(right, left, vars);

      assert.deepStrictEqual(result, right);

      assert.deepStrictEqual(vars, {
        a: Type.integer(9),
        __matched__: {value: Type.float(123.45)},
      });
    });

    // <<value::float-size(32)-unsigned>> = <<123.45::size(32)>>
    it("float type modifier, 32-bit size modifier", () => {
      const left = Type.bitstringPattern([
        Type.bitstringSegment(Type.variablePattern("value"), {
          type: "float",
          size: Type.integer(32),
          signedness: "unsigned",
        }),
      ]);

      const right = Type.bitstring([
        Type.bitstringSegment(Type.float(123.45), {
          type: "float",
          size: Type.integer(32),
        }),
      ]);

      const result = Interpreter.matchOperator(right, left, vars);

      assert.deepStrictEqual(result, right);

      assert.deepStrictEqual(vars, {
        a: Type.integer(9),
        __matched__: {value: Type.float(123.44999694824219)},
      });
    });

    // TODO: update once 16-bit float bitstring segments are implemented in Hologram
    // <<value::float-size(16)-unsigned>> = <<123.45::size(16)>>
    it("float type modifier, 16-bit size modifier", () => {
      // const left = Type.bitstringPattern([
      //   Type.bitstringSegment(Type.variablePattern("value"), {
      //     type: "float",
      //     size: Type.integer(16),
      //     signedness: "unsigned",
      //   }),
      // ]);

      assert.throw(
        () =>
          Type.bitstring([
            Type.bitstringSegment(Type.float(123.45), {
              type: "float",
              size: Type.integer(16),
            }),
          ]),
        HologramInterpreterError,
        "16-bit float bitstring segments are not yet implemented in Hologram",
      );
    });

    // <<_value::float-size(size)-unsigned>> = <<1::1, 0::1, 1::1, 0::1, 1::1, 0::1, 1::1, 0::1>>
    it("float type modifier, unsupported size modifier", () => {
      const left = Type.bitstringPattern([
        Type.bitstringSegment(Type.variablePattern("value"), {
          type: "float",
          size: Type.integer(8),
          signedness: "unsigned",
        }),
      ]);

      // 170 == 0b10101010
      const right = Type.bitstring([1, 0, 1, 0, 1, 0, 1, 0]);

      assertMatchError(
        () => Interpreter.matchOperator(right, left, vars),
        right,
      );
    });

    // <<value::integer-unsigned>> = <<1::1, 0::1, 1::1, 0::1, 1::1, 0::1, 1::1, 0::1>>
    it("integer type modifier", () => {
      const left = Type.bitstringPattern([
        Type.bitstringSegment(Type.variablePattern("value"), {
          type: "integer",
          signedness: "unsigned",
        }),
      ]);

      // 170 == 0b10101010
      const right = Type.bitstring([1, 0, 1, 0, 1, 0, 1, 0]);

      const result = Interpreter.matchOperator(right, left, vars);

      assert.deepStrictEqual(result, right);

      assert.deepStrictEqual(vars, {
        a: Type.integer(9),
        __matched__: {value: Type.integer(170)},
      });
    });

    // <value::utf8-unsigned>> won't compile
    // it("utf8 type modifier")

    // <value::utf16-unsigned>> won't compile
    // it("utf16 type modifier")

    // <value::utf32-unsigned>> won't compile
    // it("utf32 type modifier")
  });

  describe("bistring type", () => {
    const emptyBitstringPattern = Type.bitstringPattern([]);
    const emptyBitstringValue = Type.bitstring([]);

    const multiSegmentBitstringValue = Type.bitstring([
      Type.bitstringSegment(Type.integer(1), {type: "integer"}),
      Type.bitstringSegment(Type.integer(2), {type: "integer"}),
    ]);

    // <<>> = <<>>
    it("left empty bitstring == right empty bitstring", () => {
      const result = Interpreter.matchOperator(
        emptyBitstringValue,
        emptyBitstringPattern,
        vars,
      );

      assert.deepStrictEqual(result, emptyBitstringValue);
    });

    // <<>> = <<1::1, 0::1>>
    it("left empty bitstring != right non-empty bitstring", () => {
      const myBitstring = Type.bitstring([1, 0]);

      assertMatchError(
        () =>
          Interpreter.matchOperator(myBitstring, emptyBitstringPattern, vars),
        myBitstring,
      );
    });

    // <<>> = :abc
    it("left empty bitstring != right non-bitstring", () => {
      const myAtom = Type.atom("abc");

      assertMatchError(
        () => Interpreter.matchOperator(myAtom, emptyBitstringPattern, vars),
        myAtom,
      );
    });

    it("left literal single-segment bitstring == right literal single-segment bitstring", () => {
      const result = Interpreter.matchOperator(
        Type.bitstring([
          Type.bitstringSegment(Type.integer(1), {type: "integer"}),
        ]),
        Type.bitstringPattern([
          Type.bitstringSegment(Type.integer(1), {type: "integer"}),
        ]),
        vars,
      );

      const expected = Type.bitstring([
        Type.bitstringSegment(Type.integer(1), {type: "integer"}),
      ]);

      assert.deepStrictEqual(result, expected);
    });

    it("left literal single-segment bitstring != right literal single-segment bitstring", () => {
      const myBitstring = Type.bitstring([
        Type.bitstringSegment(Type.integer(2), {type: "integer"}),
      ]);

      assertMatchError(
        () =>
          Interpreter.matchOperator(
            myBitstring,
            Type.bitstringPattern([
              Type.bitstringSegment(Type.integer(1), {type: "integer"}),
            ]),
            vars,
          ),
        myBitstring,
      );
    });

    it("left literal single-segment bitstring != right non-bitstring", () => {
      const myAtom = Type.atom("abc");

      assertMatchError(
        () =>
          Interpreter.matchOperator(
            myAtom,
            Type.bitstringPattern([
              Type.bitstringSegment(Type.integer(1), {type: "integer"}),
            ]),
            vars,
          ),
        myAtom,
      );
    });

    it("multiple literal bitstring segments", () => {
      const result = Interpreter.matchOperator(
        Type.bitstring([
          Type.bitstringSegment(Type.integer(1), {
            type: "integer",
            size: Type.integer(1),
          }),
          Type.bitstringSegment(Type.integer(0), {
            type: "integer",
            size: Type.integer(1),
          }),
        ]),
        Type.bitstringPattern([
          Type.bitstringSegment(Type.integer(1), {
            type: "integer",
            size: Type.integer(1),
          }),
          Type.bitstringSegment(Type.integer(0), {
            type: "integer",
            size: Type.integer(1),
          }),
        ]),
        vars,
      );

      const expected = Type.bitstring([
        Type.bitstringSegment(Type.integer(1), {
          type: "integer",
          size: Type.integer(1),
        }),
        Type.bitstringSegment(Type.integer(0), {
          type: "integer",
          size: Type.integer(1),
        }),
      ]);

      assert.deepStrictEqual(result, expected);
    });

    it("multiple literal float segments", () => {
      const result = Interpreter.matchOperator(
        Type.bitstring([
          Type.bitstringSegment(Type.float(1.0), {type: "float"}),
          Type.bitstringSegment(Type.float(2.0), {type: "float"}),
        ]),
        Type.bitstringPattern([
          Type.bitstringSegment(Type.float(1.0), {type: "float"}),
          Type.bitstringSegment(Type.float(2.0), {type: "float"}),
        ]),
        vars,
      );

      const expected = Type.bitstring([
        Type.bitstringSegment(Type.float(1.0), {type: "float"}),
        Type.bitstringSegment(Type.float(2.0), {type: "float"}),
      ]);

      assert.deepStrictEqual(result, expected);
    });

    it("multiple literal integer segments", () => {
      const result = Interpreter.matchOperator(
        Type.bitstring([
          Type.bitstringSegment(Type.integer(1), {type: "integer"}),
          Type.bitstringSegment(Type.integer(2), {type: "integer"}),
        ]),
        Type.bitstringPattern([
          Type.bitstringSegment(Type.integer(1), {type: "integer"}),
          Type.bitstringSegment(Type.integer(2), {type: "integer"}),
        ]),
        vars,
      );

      const expected = Type.bitstring([
        Type.bitstringSegment(Type.integer(1), {type: "integer"}),
        Type.bitstringSegment(Type.integer(2), {type: "integer"}),
      ]);

      assert.deepStrictEqual(result, expected);
    });

    it("multiple literal string segments", () => {
      const result = Interpreter.matchOperator(
        Type.bitstring([
          Type.bitstringSegment(Type.string("aaa"), {type: "utf8"}),
          Type.bitstringSegment(Type.string("bbb"), {type: "utf8"}),
        ]),
        Type.bitstringPattern([
          Type.bitstringSegment(Type.string("aaa"), {type: "utf8"}),
          Type.bitstringSegment(Type.string("bbb"), {type: "utf8"}),
        ]),
        vars,
      );

      const expected = Type.bitstring([
        Type.bitstringSegment(Type.string("aaa"), {type: "utf8"}),
        Type.bitstringSegment(Type.string("bbb"), {type: "utf8"}),
      ]);

      assert.deepStrictEqual(result, expected);
    });

    // <<x::integer>> = <<1>>
    it("left single-segment bitstring with variable pattern == right bistring", () => {
      const myBitstring = Type.bitstring([
        Type.bitstringSegment(Type.integer(1), {type: "integer"}),
      ]);

      const result = Interpreter.matchOperator(
        myBitstring,
        Type.bitstringPattern([
          Type.bitstringSegment(Type.variablePattern("x"), {type: "integer"}),
        ]),
        vars,
      );

      assert.deepStrictEqual(result, myBitstring);

      assert.deepStrictEqual(vars, {
        a: Type.integer(9),
        __matched__: {
          x: Type.integer(1),
        },
      });
    });

    // <<x::integer, y::integer>> = <<1, 2>>
    it("left multiple-segment bitstring with variable patterns == right bitstring", () => {
      const result = Interpreter.matchOperator(
        multiSegmentBitstringValue,
        Type.bitstringPattern([
          Type.bitstringSegment(Type.variablePattern("x"), {type: "integer"}),
          Type.bitstringSegment(Type.variablePattern("y"), {type: "integer"}),
        ]),
        vars,
      );

      assert.deepStrictEqual(result, multiSegmentBitstringValue);

      assert.deepStrictEqual(vars, {
        a: Type.integer(9),
        __matched__: {
          x: Type.integer(1),
          y: Type.integer(2),
        },
      });
    });

    // <<3, y::integer>> = <<1, 2>>
    it("first segment in left multi-segment bitstring doesn't match", () => {
      assertMatchError(
        () =>
          Interpreter.matchOperator(
            multiSegmentBitstringValue,
            Type.bitstringPattern([
              Type.bitstringSegment(Type.integer(3), {type: "integer"}),
              Type.bitstringSegment(Type.variablePattern("y"), {
                type: "integer",
              }),
            ]),
            vars,
          ),
        multiSegmentBitstringValue,
      );
    });

    // <<1, 2::size(7)>> = <<1, 2>>
    it("last segment in left multi-segment bitstring doesn't match, because there are too few bits", () => {
      assertMatchError(
        () =>
          Interpreter.matchOperator(
            multiSegmentBitstringValue,
            Type.bitstringPattern([
              Type.bitstringSegment(Type.integer(1), {type: "integer"}),
              Type.bitstringSegment(Type.integer(2), {
                type: "integer",
                size: Type.integer(7),
              }),
            ]),
            vars,
          ),
        multiSegmentBitstringValue,
      );
    });

    // <<1, 2::size(9)>> = <<1, 2>>
    it("last segment in left multi-segment bitstring doesn't match, because there are too many bits", () => {
      assertMatchError(
        () =>
          Interpreter.matchOperator(
            multiSegmentBitstringValue,
            Type.bitstringPattern([
              Type.bitstringSegment(Type.integer(1), {type: "integer"}),
              Type.bitstringSegment(Type.integer(2), {
                type: "integer",
                size: Type.integer(9),
              }),
            ]),
            vars,
          ),
        multiSegmentBitstringValue,
      );
    });
  });

  // TODO: finish overhaul, remember about Elixir consistency tests
  // describe("cons pattern", () => {
  //   describe("[h | t]", () => {
  //     let left;
  //     beforeEach(() => {
  //       left = Type.consPattern(
  //         Type.variablePattern("h"),
  //         Type.variablePattern("t"),
  //       );
  //     });
  //     it("[h | t] = 1", () => {
  //       const right = Type.integer(1);
  //       assertMatchError(
  //         () => Interpreter.matchOperator(right, left, vars),
  //         right,
  //       );
  //     });
  //     it("[h | t] = []", () => {
  //       const right = Type.list([]);
  //       assertMatchError(
  //         () => Interpreter.matchOperator(right, left, vars),
  //         right,
  //       );
  //     });
  //     it("[h | t] = [1]", () => {
  //       const right = Type.list([Type.integer(1)]);
  //       const result = Interpreter.matchOperator(right, left, vars);
  //       assert.deepStrictEqual(result, right);
  //       assert.deepStrictEqual(vars, {
  //         a: Type.integer(9),
  //         h: Type.integer(1),
  //         t: Type.list([]),
  //       });
  //     });
  //     it("[h | t] = [1, 2]", () => {
  //       const right = Type.list([Type.integer(1), Type.integer(2)]);
  //       const result = Interpreter.matchOperator(right, left, vars);
  //       assert.deepStrictEqual(result, right);
  //       assert.deepStrictEqual(vars, {
  //         a: Type.integer(9),
  //         h: Type.integer(1),
  //         t: Type.list([Type.integer(2)]),
  //       });
  //     });
  //     it("[h | t] = [1 | 2]", () => {
  //       const right = Type.improperList([Type.integer(1), Type.integer(2)]);
  //       const result = Interpreter.matchOperator(right, left, vars);
  //       assert.deepStrictEqual(result, right);
  //       assert.deepStrictEqual(vars, {
  //         a: Type.integer(9),
  //         h: Type.integer(1),
  //         t: Type.integer(2),
  //       });
  //     });
  //     it("[h | t] = [1, 2, 3]", () => {
  //       const right = Type.list([
  //         Type.integer(1),
  //         Type.integer(2),
  //         Type.integer(3),
  //       ]);
  //       const result = Interpreter.matchOperator(right, left, vars);
  //       assert.deepStrictEqual(result, right);
  //       assert.deepStrictEqual(vars, {
  //         a: Type.integer(9),
  //         h: Type.integer(1),
  //         t: Type.list([Type.integer(2), Type.integer(3)]),
  //       });
  //     });
  //     it("[h | t] = [1, 2 | 3]", () => {
  //       const right = Type.improperList([
  //         Type.integer(1),
  //         Type.integer(2),
  //         Type.integer(3),
  //       ]);
  //       const result = Interpreter.matchOperator(right, left, vars);
  //       assert.deepStrictEqual(result, right);
  //       assert.deepStrictEqual(vars, {
  //         a: Type.integer(9),
  //         h: Type.integer(1),
  //         t: Type.improperList([Type.integer(2), Type.integer(3)]),
  //       });
  //     });
  //   });
  //   describe("[1 | t]", () => {
  //     let left;
  //     beforeEach(() => {
  //       left = Type.consPattern(Type.integer(1), Type.variablePattern("t"));
  //     });
  //     it("[1 | t] = 1", () => {
  //       const right = Type.integer(1);
  //       assertMatchError(
  //         () => Interpreter.matchOperator(right, left, vars),
  //         right,
  //       );
  //     });
  //     it("[1 | t] = []", () => {
  //       const right = Type.list([]);
  //       assertMatchError(
  //         () => Interpreter.matchOperator(right, left, vars),
  //         right,
  //       );
  //     });
  //     it("[1 | t] = [1]", () => {
  //       const right = Type.list([Type.integer(1)]);
  //       const result = Interpreter.matchOperator(right, left, vars);
  //       assert.deepStrictEqual(result, right);
  //       assert.deepStrictEqual(vars, {
  //         a: Type.integer(9),
  //         t: Type.list([]),
  //       });
  //     });
  //     it("[1 | t] = [5]", () => {
  //       const right = Type.list([Type.integer(5)]);
  //       assertMatchError(
  //         () => Interpreter.matchOperator(right, left, vars),
  //         right,
  //       );
  //     });
  //     it("[1 | t] = [1, 2]", () => {
  //       const right = Type.list([Type.integer(1), Type.integer(2)]);
  //       const result = Interpreter.matchOperator(right, left, vars);
  //       assert.deepStrictEqual(result, right);
  //       assert.deepStrictEqual(vars, {
  //         a: Type.integer(9),
  //         t: Type.list([Type.integer(2)]),
  //       });
  //     });
  //     it("[1 | t] = [5, 2]", () => {
  //       const right = Type.list([Type.integer(5), Type.integer(2)]);
  //       assertMatchError(
  //         () => Interpreter.matchOperator(right, left, vars),
  //         right,
  //       );
  //     });
  //     it("[1 | t] = [1 | 2]", () => {
  //       const right = Type.improperList([Type.integer(1), Type.integer(2)]);
  //       const result = Interpreter.matchOperator(right, left, vars);
  //       assert.deepStrictEqual(result, right);
  //       assert.deepStrictEqual(vars, {
  //         a: Type.integer(9),
  //         t: Type.integer(2),
  //       });
  //     });
  //     it("[1 | t] = [5 | 2]", () => {
  //       const right = Type.improperList([Type.integer(5), Type.integer(2)]);
  //       assertMatchError(
  //         () => Interpreter.matchOperator(right, left, vars),
  //         right,
  //       );
  //     });
  //     it("[1 | t] = [1, 2, 3]", () => {
  //       const right = Type.list([
  //         Type.integer(1),
  //         Type.integer(2),
  //         Type.integer(3),
  //       ]);
  //       const result = Interpreter.matchOperator(right, left, vars);
  //       assert.deepStrictEqual(result, right);
  //       assert.deepStrictEqual(vars, {
  //         a: Type.integer(9),
  //         t: Type.list([Type.integer(2), Type.integer(3)]),
  //       });
  //     });
  //     it("[1 | t] = [5, 2, 3]", () => {
  //       const right = Type.list([
  //         Type.integer(5),
  //         Type.integer(2),
  //         Type.integer(3),
  //       ]);
  //       assertMatchError(
  //         () => Interpreter.matchOperator(right, left, vars),
  //         right,
  //       );
  //     });
  //     it("[1 | t] = [1, 2 | 3]", () => {
  //       const right = Type.improperList([
  //         Type.integer(1),
  //         Type.integer(2),
  //         Type.integer(3),
  //       ]);
  //       const result = Interpreter.matchOperator(right, left, vars);
  //       assert.deepStrictEqual(result, right);
  //       assert.deepStrictEqual(vars, {
  //         a: Type.integer(9),
  //         t: Type.improperList([Type.integer(2), Type.integer(3)]),
  //       });
  //     });
  //     it("[1 | t] = [5, 2 | 3]", () => {
  //       const right = Type.improperList([
  //         Type.integer(5),
  //         Type.integer(2),
  //         Type.integer(3),
  //       ]);
  //       assertMatchError(
  //         () => Interpreter.matchOperator(right, left, vars),
  //         right,
  //       );
  //     });
  //   });
  //   describe("[h | 3]", () => {
  //     let left;
  //     beforeEach(() => {
  //       left = Type.consPattern(Type.variablePattern("h"), Type.integer(3));
  //     });
  //     it("[h | 3] = 3", () => {
  //       const right = Type.integer(3);
  //       assertMatchError(
  //         () => Interpreter.matchOperator(right, left, vars),
  //         right,
  //       );
  //     });
  //     it("[h | 3] = []", () => {
  //       const right = Type.list([]);
  //       assertMatchError(
  //         () => Interpreter.matchOperator(right, left, vars),
  //         right,
  //       );
  //     });
  //     it("[h | 3] = [3]", () => {
  //       const right = Type.list([Type.integer(3)]);
  //       assertMatchError(
  //         () => Interpreter.matchOperator(right, left, vars),
  //         right,
  //       );
  //     });
  //     it("[h | 3] = [2, 3]", () => {
  //       const right = Type.list([Type.integer(2), Type.integer(3)]);
  //       assertMatchError(
  //         () => Interpreter.matchOperator(right, left, vars),
  //         right,
  //       );
  //     });
  //     it("[h | 3] = [2 | 3]", () => {
  //       const right = Type.improperList([Type.integer(2), Type.integer(3)]);
  //       const result = Interpreter.matchOperator(right, left, vars);
  //       assert.deepStrictEqual(result, right);
  //       assert.deepStrictEqual(vars, {
  //         a: Type.integer(9),
  //         h: Type.integer(2),
  //       });
  //     });
  //     it("[h | 3] = [1, 2, 3]", () => {
  //       const right = Type.list([
  //         Type.integer(1),
  //         Type.integer(2),
  //         Type.integer(3),
  //       ]);
  //       assertMatchError(
  //         () => Interpreter.matchOperator(right, left, vars),
  //         right,
  //       );
  //     });
  //     it("[h | 3] = [1, 2 | 3]", () => {
  //       const right = Type.improperList([
  //         Type.integer(1),
  //         Type.integer(2),
  //         Type.integer(3),
  //       ]);
  //       assertMatchError(
  //         () => Interpreter.matchOperator(right, left, vars),
  //         right,
  //       );
  //     });
  //   });
  //   describe("[h | []]", () => {
  //     let left;
  //     beforeEach(() => {
  //       left = Type.consPattern(Type.variablePattern("h"), Type.list([]));
  //     });
  //     it("[h | []] = 3", () => {
  //       const right = Type.integer(3);
  //       assertMatchError(
  //         () => Interpreter.matchOperator(right, left, vars),
  //         right,
  //       );
  //     });
  //     it("[h | []] = []", () => {
  //       const right = Type.list([]);
  //       assertMatchError(
  //         () => Interpreter.matchOperator(right, left, vars),
  //         right,
  //       );
  //     });
  //     it("[h | []] = [3]", () => {
  //       const right = Type.list([Type.integer(3)]);
  //       const result = Interpreter.matchOperator(right, left, vars);
  //       assert.deepStrictEqual(result, right);
  //       assert.deepStrictEqual(vars, {
  //         a: Type.integer(9),
  //         h: Type.integer(3),
  //       });
  //     });
  //     it("[h | []] = [2, 3]", () => {
  //       const right = Type.list([Type.integer(2), Type.integer(3)]);
  //       assertMatchError(
  //         () => Interpreter.matchOperator(right, left, vars),
  //         right,
  //       );
  //     });
  //     it("[h | []] = [2 | 3]", () => {
  //       const right = Type.improperList([Type.integer(2), Type.integer(3)]);
  //       assertMatchError(
  //         () => Interpreter.matchOperator(right, left, vars),
  //         right,
  //       );
  //     });
  //     it("[h | []] = [1, 2, 3]", () => {
  //       const right = Type.list([
  //         Type.integer(1),
  //         Type.integer(2),
  //         Type.integer(3),
  //       ]);
  //       assertMatchError(
  //         () => Interpreter.matchOperator(right, left, vars),
  //         right,
  //       );
  //     });
  //     it("[h | []] = [1, 2 | 3]", () => {
  //       const right = Type.improperList([
  //         Type.integer(1),
  //         Type.integer(2),
  //         Type.integer(3),
  //       ]);
  //       assertMatchError(
  //         () => Interpreter.matchOperator(right, left, vars),
  //         right,
  //       );
  //     });
  //   });
  //   describe("[h | [3]]", () => {
  //     let left;
  //     beforeEach(() => {
  //       left = Type.consPattern(
  //         Type.variablePattern("h"),
  //         Type.list([Type.integer(3)]),
  //       );
  //     });
  //     it("[h | [3]] = 3", () => {
  //       const right = Type.integer(3);
  //       assertMatchError(
  //         () => Interpreter.matchOperator(right, left, vars),
  //         right,
  //       );
  //     });
  //     it("[h | [3]] = []", () => {
  //       const right = Type.list([]);
  //       assertMatchError(
  //         () => Interpreter.matchOperator(right, left, vars),
  //         right,
  //       );
  //     });
  //     it("[h | [3]] = [3]", () => {
  //       const right = Type.list([Type.integer(3)]);
  //       assertMatchError(
  //         () => Interpreter.matchOperator(right, left, vars),
  //         right,
  //       );
  //     });
  //     it("[h | [3]] = [2, 3]", () => {
  //       const right = Type.list([Type.integer(2), Type.integer(3)]);
  //       const result = Interpreter.matchOperator(right, left, vars);
  //       assert.deepStrictEqual(result, right);
  //       assert.deepStrictEqual(vars, {
  //         a: Type.integer(9),
  //         h: Type.integer(2),
  //       });
  //     });
  //     it("[h | [3]] = [2 | 3]", () => {
  //       const right = Type.improperList([Type.integer(2), Type.integer(3)]);
  //       assertMatchError(
  //         () => Interpreter.matchOperator(right, left, vars),
  //         right,
  //       );
  //     });
  //     it("[h | [3]] = [1, 2, 3]", () => {
  //       const right = Type.list([
  //         Type.integer(1),
  //         Type.integer(2),
  //         Type.integer(3),
  //       ]);
  //       assertMatchError(
  //         () => Interpreter.matchOperator(right, left, vars),
  //         right,
  //       );
  //     });
  //     it("[h | [3]] = [1, 2 | 3]", () => {
  //       const right = Type.improperList([
  //         Type.integer(1),
  //         Type.integer(2),
  //         Type.integer(3),
  //       ]);
  //       assertMatchError(
  //         () => Interpreter.matchOperator(right, left, vars),
  //         right,
  //       );
  //     });
  //   });
  //   describe("[h | [2, 3]]", () => {
  //     let left;
  //     beforeEach(() => {
  //       left = Type.consPattern(
  //         Type.variablePattern("h"),
  //         Type.list([Type.integer(2), Type.integer(3)]),
  //       );
  //     });
  //     it("[h | [2, 3]] = 3", () => {
  //       const right = Type.integer(3);
  //       assertMatchError(
  //         () => Interpreter.matchOperator(right, left, vars),
  //         right,
  //       );
  //     });
  //     it("[h | [2, 3]] = []", () => {
  //       const right = Type.list([]);
  //       assertMatchError(
  //         () => Interpreter.matchOperator(right, left, vars),
  //         right,
  //       );
  //     });
  //     it("[h | [2, 3]] = [3]", () => {
  //       const right = Type.list([Type.integer(3)]);
  //       assertMatchError(
  //         () => Interpreter.matchOperator(right, left, vars),
  //         right,
  //       );
  //     });
  //     it("[h | [2, 3]] = [2, 3]", () => {
  //       const right = Type.list([Type.integer(2), Type.integer(3)]);
  //       assertMatchError(
  //         () => Interpreter.matchOperator(right, left, vars),
  //         right,
  //       );
  //     });
  //     it("[h | [2, 3]] = [2 | 3]", () => {
  //       const right = Type.improperList([Type.integer(2), Type.integer(3)]);
  //       assertMatchError(
  //         () => Interpreter.matchOperator(right, left, vars),
  //         right,
  //       );
  //     });
  //     it("[h | [2, 3]] = [1, 2, 3]", () => {
  //       const right = Type.list([
  //         Type.integer(1),
  //         Type.integer(2),
  //         Type.integer(3),
  //       ]);
  //       const result = Interpreter.matchOperator(right, left, vars);
  //       assert.deepStrictEqual(result, right);
  //       assert.deepStrictEqual(vars, {
  //         a: Type.integer(9),
  //         h: Type.integer(1),
  //       });
  //     });
  //     it("[h | [2, 3]] = [1, 2 | 3]", () => {
  //       const right = Type.improperList([
  //         Type.integer(1),
  //         Type.integer(2),
  //         Type.integer(3),
  //       ]);
  //       assertMatchError(
  //         () => Interpreter.matchOperator(right, left, vars),
  //         right,
  //       );
  //     });
  //   });
  //   describe("[h | [2 | 3]]", () => {
  //     let left;
  //     beforeEach(() => {
  //       left = Type.consPattern(
  //         Type.variablePattern("h"),
  //         Type.consPattern(Type.integer(2), Type.integer(3)),
  //       );
  //     });
  //     it("[h | [2 | 3]] = 3", () => {
  //       const right = Type.integer(3);
  //       assertMatchError(
  //         () => Interpreter.matchOperator(right, left, vars),
  //         right,
  //       );
  //     });
  //     it("[h | [2 | 3]] = []", () => {
  //       const right = Type.list([]);
  //       assertMatchError(
  //         () => Interpreter.matchOperator(right, left, vars),
  //         right,
  //       );
  //     });
  //     it("[h | [2 | 3]] = [3]", () => {
  //       const right = Type.list([Type.integer(3)]);
  //       assertMatchError(
  //         () => Interpreter.matchOperator(right, left, vars),
  //         right,
  //       );
  //     });
  //     it("[h | [2 | 3]] = [2, 3]", () => {
  //       const right = Type.list([Type.integer(2), Type.integer(3)]);
  //       assertMatchError(
  //         () => Interpreter.matchOperator(right, left, vars),
  //         right,
  //       );
  //     });
  //     it("[h | [2 | 3]] = [2 | 3]", () => {
  //       const right = Type.improperList([Type.integer(2), Type.integer(3)]);
  //       assertMatchError(
  //         () => Interpreter.matchOperator(right, left, vars),
  //         right,
  //       );
  //     });
  //     it("[h | [2 | 3]] = [1, 2, 3]", () => {
  //       const right = Type.list([
  //         Type.integer(1),
  //         Type.integer(2),
  //         Type.integer(3),
  //       ]);
  //       assertMatchError(
  //         () => Interpreter.matchOperator(right, left, vars),
  //         right,
  //       );
  //     });
  //     it("[h | [2 | 3]] = [1, 2 | 3]", () => {
  //       const right = Type.improperList([
  //         Type.integer(1),
  //         Type.integer(2),
  //         Type.integer(3),
  //       ]);
  //       const result = Interpreter.matchOperator(right, left, vars);
  //       assert.deepStrictEqual(result, right);
  //       assert.deepStrictEqual(vars, {
  //         a: Type.integer(9),
  //         h: Type.integer(1),
  //       });
  //     });
  //   });
  //   describe("[h | [1, 2, 3]]", () => {
  //     let left;
  //     beforeEach(() => {
  //       left = Type.consPattern(
  //         Type.variablePattern("h"),
  //         Type.list([Type.integer(1), Type.integer(2), Type.integer(3)]),
  //       );
  //     });
  //     it("[h | [1, 2, 3]] = 3", () => {
  //       const right = Type.integer(3);
  //       assertMatchError(
  //         () => Interpreter.matchOperator(right, left, vars),
  //         right,
  //       );
  //     });
  //     it("[h | [1, 2, 3]] = []", () => {
  //       const right = Type.list([]);
  //       assertMatchError(
  //         () => Interpreter.matchOperator(right, left, vars),
  //         right,
  //       );
  //     });
  //     it("[h | [1, 2, 3]] = [3]", () => {
  //       const right = Type.list([Type.integer(3)]);
  //       assertMatchError(
  //         () => Interpreter.matchOperator(right, left, vars),
  //         right,
  //       );
  //     });
  //     it("[h | [1, 2, 3]] = [2, 3]", () => {
  //       const right = Type.list([Type.integer(2), Type.integer(3)]);
  //       assertMatchError(
  //         () => Interpreter.matchOperator(right, left, vars),
  //         right,
  //       );
  //     });
  //     it("[h | [1, 2, 3]] = [2 | 3]", () => {
  //       const right = Type.improperList([Type.integer(2), Type.integer(3)]);
  //       assertMatchError(
  //         () => Interpreter.matchOperator(right, left, vars),
  //         right,
  //       );
  //     });
  //     it("[h | [1, 2, 3]] = [1, 2, 3]", () => {
  //       const right = Type.list([
  //         Type.integer(1),
  //         Type.integer(2),
  //         Type.integer(3),
  //       ]);
  //       assertMatchError(
  //         () => Interpreter.matchOperator(right, left, vars),
  //         right,
  //       );
  //     });
  //     it("[h | [1, 2, 3]] = [1, 2 | 3]", () => {
  //       const right = Type.improperList([
  //         Type.integer(1),
  //         Type.integer(2),
  //         Type.integer(3),
  //       ]);
  //       assertMatchError(
  //         () => Interpreter.matchOperator(right, left, vars),
  //         right,
  //       );
  //     });
  //   });
  //   describe("[h | [1, 2 | 3]]", () => {
  //     let left;
  //     beforeEach(() => {
  //       left = Type.consPattern(
  //         Type.variablePattern("h"),
  //         Type.consPattern(
  //           Type.integer(1),
  //           Type.consPattern(Type.integer(2), Type.integer(3)),
  //         ),
  //       );
  //     });
  //     it("[h | [1, 2 | 3]] = 3", () => {
  //       const right = Type.integer(3);
  //       assertMatchError(
  //         () => Interpreter.matchOperator(right, left, vars),
  //         right,
  //       );
  //     });
  //     it("[h | [1, 2 | 3]] = []", () => {
  //       const right = Type.list([]);
  //       assertMatchError(
  //         () => Interpreter.matchOperator(right, left, vars),
  //         right,
  //       );
  //     });
  //     it("[h | [1, 2 | 3]] = [3]", () => {
  //       const right = Type.list([Type.integer(3)]);
  //       assertMatchError(
  //         () => Interpreter.matchOperator(right, left, vars),
  //         right,
  //       );
  //     });
  //     it("[h | [1, 2 | 3]] = [2, 3]", () => {
  //       const right = Type.list([Type.integer(2), Type.integer(3)]);
  //       assertMatchError(
  //         () => Interpreter.matchOperator(right, left, vars),
  //         right,
  //       );
  //     });
  //     it("[h | [1, 2 | 3]] = [2 | 3]", () => {
  //       const right = Type.improperList([Type.integer(2), Type.integer(3)]);
  //       assertMatchError(
  //         () => Interpreter.matchOperator(right, left, vars),
  //         right,
  //       );
  //     });
  //     it("[h | [1, 2 | 3]] = [1, 2, 3]", () => {
  //       const right = Type.list([
  //         Type.integer(1),
  //         Type.integer(2),
  //         Type.integer(3),
  //       ]);
  //       assertMatchError(
  //         () => Interpreter.matchOperator(right, left, vars),
  //         right,
  //       );
  //     });
  //     it("[h | [1, 2 | 3]] = [1, 2 | 3]", () => {
  //       const right = Type.improperList([
  //         Type.integer(1),
  //         Type.integer(2),
  //         Type.integer(3),
  //       ]);
  //       assertMatchError(
  //         () => Interpreter.matchOperator(right, left, vars),
  //         right,
  //       );
  //     });
  //   });
  //   describe("[1 | [2 | [3 | []]]]", () => {
  //     let left;
  //     beforeEach(() => {
  //       left = Type.consPattern(
  //         Type.integer(1),
  //         Type.consPattern(
  //           Type.integer(2),
  //           Type.consPattern(Type.integer(3), Type.list([])),
  //         ),
  //       );
  //     });
  //     it("[1 | [2 | [3 | []]]] = [1, 2, 3, 4]", () => {
  //       const right = Type.list([
  //         Type.integer(1),
  //         Type.integer(2),
  //         Type.integer(3),
  //         Type.integer(4),
  //       ]);
  //       assertMatchError(
  //         () => Interpreter.matchOperator(right, left, vars),
  //         right,
  //       );
  //     });
  //     it("[1 | [2 | [3 | []]]] = [1, 2, 3 | 4]", () => {
  //       const right = Type.improperList([
  //         Type.integer(1),
  //         Type.integer(2),
  //         Type.integer(3),
  //         Type.integer(4),
  //       ]);
  //       assertMatchError(
  //         () => Interpreter.matchOperator(right, left, vars),
  //         right,
  //       );
  //     });
  //     it("[1 | [2 | [3 | []]]] = [1, 2, 3]", () => {
  //       const right = Type.list([
  //         Type.integer(1),
  //         Type.integer(2),
  //         Type.integer(3),
  //       ]);
  //       const result = Interpreter.matchOperator(right, left, vars);
  //       assert.deepStrictEqual(result, right);
  //       assert.deepStrictEqual(vars, {a: Type.integer(9)});
  //     });
  //   });
  //   describe("[1 | [2 | [3 | 4]]]", () => {
  //     let left;
  //     beforeEach(() => {
  //       left = Type.consPattern(
  //         Type.integer(1),
  //         Type.consPattern(
  //           Type.integer(2),
  //           Type.consPattern(Type.integer(3), Type.integer(4)),
  //         ),
  //       );
  //     });
  //     it("[1 | [2 | [3 | 4]]] = [1, 2, 3, 4]", () => {
  //       const right = Type.list([
  //         Type.integer(1),
  //         Type.integer(2),
  //         Type.integer(3),
  //         Type.integer(4),
  //       ]);
  //       assertMatchError(
  //         () => Interpreter.matchOperator(right, left, vars),
  //         right,
  //       );
  //     });
  //     it("[1 | [2 | [3 | 4]]] = [1, 2, 3 | 4]", () => {
  //       const right = Type.improperList([
  //         Type.integer(1),
  //         Type.integer(2),
  //         Type.integer(3),
  //         Type.integer(4),
  //       ]);
  //       const result = Interpreter.matchOperator(right, left, vars);
  //       assert.deepStrictEqual(result, right);
  //       assert.deepStrictEqual(vars, {a: Type.integer(9)});
  //     });
  //     it("[1 | [2 | [3 | 4]]] = [1, 2, 3]", () => {
  //       const right = Type.list([
  //         Type.integer(1),
  //         Type.integer(2),
  //         Type.integer(3),
  //       ]);
  //       assertMatchError(
  //         () => Interpreter.matchOperator(right, left, vars),
  //         right,
  //       );
  //     });
  //   });
  //   describe("[1 | [2 | [3 | [4]]]]", () => {
  //     let left;
  //     beforeEach(() => {
  //       left = Type.consPattern(
  //         Type.integer(1),
  //         Type.consPattern(
  //           Type.integer(2),
  //           Type.consPattern(Type.integer(3), Type.list([Type.integer(4)])),
  //         ),
  //       );
  //     });
  //     it("[1 | [2 | [3 | [4]]]] = [1, 2, 3, 4]", () => {
  //       const right = Type.list([
  //         Type.integer(1),
  //         Type.integer(2),
  //         Type.integer(3),
  //         Type.integer(4),
  //       ]);
  //       const result = Interpreter.matchOperator(right, left, vars);
  //       assert.deepStrictEqual(result, right);
  //       assert.deepStrictEqual(vars, {a: Type.integer(9)});
  //     });
  //     it("[1 | [2 | [3 | [4]]]] = [1, 2, 3 | 4]", () => {
  //       const right = Type.improperList([
  //         Type.integer(1),
  //         Type.integer(2),
  //         Type.integer(3),
  //         Type.integer(4),
  //       ]);
  //       assertMatchError(
  //         () => Interpreter.matchOperator(right, left, vars),
  //         right,
  //       );
  //     });
  //     it("[1 | [2 | [3 | [4]]]] = [1, 2, 3]", () => {
  //       const right = Type.list([
  //         Type.integer(1),
  //         Type.integer(2),
  //         Type.integer(3),
  //       ]);
  //       assertMatchError(
  //         () => Interpreter.matchOperator(right, left, vars),
  //         right,
  //       );
  //     });
  //   });
  // });

  // TODO: finish overhaul, remember about Elixir consistency tests
  // describe("float type", () => {
  //   it("left float == right float", () => {
  //     // 2.0 = 2.0
  //     const result = Interpreter.matchOperator(
  //       Type.float(2.0),
  //       Type.float(2.0),
  //       vars,
  //     );
  //     assert.deepStrictEqual(result, Type.float(2.0));
  //     assert.deepStrictEqual(vars, {a: Type.integer(9)});
  //   });
  //   it("left float != right float", () => {
  //     const myFloat = Type.float(3.0);
  //     // 2.0 = 3.0
  //     assertMatchError(
  //       () => Interpreter.matchOperator(myFloat, Type.float(2.0), vars),
  //       myFloat,
  //     );
  //   });
  //   it("left float != right non-float", () => {
  //     const myAtom = Type.atom("abc");
  //     // 2.0 = :abc
  //     assertMatchError(
  //       () => Interpreter.matchOperator(myAtom, Type.float(2.0), vars),
  //       myAtom,
  //     );
  //   });
  // });

  // TODO: finish overhaul, remember about Elixir consistency tests
  // describe("integer type", () => {
  //   it("left integer == right integer", () => {
  //     // 2 = 2
  //     const result = Interpreter.matchOperator(
  //       Type.integer(2),
  //       Type.integer(2),
  //       vars,
  //     );
  //     assert.deepStrictEqual(result, Type.integer(2));
  //     assert.deepStrictEqual(vars, {a: Type.integer(9)});
  //   });
  //   it("left integer != right integer", () => {
  //     const myInteger = Type.integer(3);
  //     // 2 = 3
  //     assertMatchError(
  //       () => Interpreter.matchOperator(myInteger, Type.integer(2), vars),
  //       myInteger,
  //     );
  //   });
  //   it("left integer != right non-integer", () => {
  //     const myAtom = Type.atom("abc");
  //     // 2 = :abc
  //     assertMatchError(
  //       () => Interpreter.matchOperator(myAtom, Type.integer(2), vars),
  //       myAtom,
  //     );
  //   });
  // });

  // TODO: finish overhaul, remember about Elixir consistency tests
  // describe("list type", () => {
  //   let list1;
  //   beforeEach(() => {
  //     list1 = Type.list([Type.integer(1), Type.integer(2)]);
  //   });
  //   it("[1, 2] = [1, 2]", () => {
  //     const result = Interpreter.matchOperator(list1, list1, vars);
  //     assert.deepStrictEqual(result, list1);
  //     assert.deepStrictEqual(vars, {a: Type.integer(9)});
  //   });
  //   it("[1, 2] = [1, 3]", () => {
  //     const list2 = Type.list([Type.integer(1), Type.integer(3)]);
  //     assertMatchError(
  //       () => Interpreter.matchOperator(list2, list1, vars),
  //       list2,
  //     );
  //   });
  //   it("[1, 2] = [1 | 2]", () => {
  //     const list2 = Type.improperList([Type.integer(1), Type.integer(2)]);
  //     assertMatchError(
  //       () => Interpreter.matchOperator(list2, list1, vars),
  //       list2,
  //     );
  //   });
  //   it("[1, 2] = :abc", () => {
  //     const myAtom = Type.atom("abc");
  //     assertMatchError(
  //       () => Interpreter.matchOperator(myAtom, list1, vars),
  //       myAtom,
  //     );
  //   });
  //   it("[] = [1, 2]", () => {
  //     assertMatchError(
  //       () => Interpreter.matchOperator(list1, Type.list([]), vars),
  //       list1,
  //     );
  //   });
  //   it("[1, 2] = []", () => {
  //     const emptyList = Type.list([]);
  //     assertMatchError(
  //       () => Interpreter.matchOperator(emptyList, list1, vars),
  //       emptyList,
  //     );
  //   });
  //   it("[] = []", () => {
  //     const emptyList = Type.list([]);
  //     const result = Interpreter.matchOperator(emptyList, emptyList, vars);
  //     assert.deepStrictEqual(result, emptyList);
  //     assert.deepStrictEqual(vars, {a: Type.integer(9)});
  //   });
  //   it("[x, 2, y] = [1, 2, 3]", () => {
  //     const left = Type.list([
  //       Type.variablePattern("x"),
  //       Type.integer(2),
  //       Type.variablePattern("y"),
  //     ]);
  //     const right = Type.list([
  //       Type.integer(1),
  //       Type.integer(2),
  //       Type.integer(3),
  //     ]);
  //     const result = Interpreter.matchOperator(right, left, vars);
  //     assert.deepStrictEqual(result, right);
  //     const expectedVars = {
  //       a: Type.integer(9),
  //       x: Type.integer(1),
  //       y: Type.integer(3),
  //     };
  //     assert.deepStrictEqual(vars, expectedVars);
  //   });
  // });

  describe("map type", () => {
    const map = Type.map([
      [Type.atom("x"), Type.integer(1)],
      [Type.atom("y"), Type.integer(2)],
    ]);

    const emptyMap = Type.map([]);

    // %{x: 1, y: 2} = %{x: 1, y: 2}
    it("left and right maps have the same items", () => {
      const left = map;
      const right = clone(map);
      const result = Interpreter.matchOperator(right, left, vars);

      assert.deepStrictEqual(result, right);
      assert.deepStrictEqual(vars, varsWithEmptyMatchedValues);
    });

    // %{x: 1, y: 2} = %{x: 1, y: 2, z: 3}
    it("right map has all the same items as the left map plus additional ones", () => {
      const left = map;

      const right = Type.map([
        [Type.atom("x"), Type.integer(1)],
        [Type.atom("y"), Type.integer(2)],
        [Type.atom("z"), Type.integer(3)],
      ]);

      const result = Interpreter.matchOperator(right, left, vars);

      assert.deepStrictEqual(result, right);
      assert.deepStrictEqual(vars, varsWithEmptyMatchedValues);
    });

    // %{x: 1, y: 2, z: 3} = %{x: 1, y: 2}
    it("right map is missing some some keys from the left map", () => {
      const left = Type.map([
        [Type.atom("x"), Type.integer(1)],
        [Type.atom("y"), Type.integer(2)],
        [Type.atom("z"), Type.integer(3)],
      ]);

      const right = map;

      assertMatchError(
        () => Interpreter.matchOperator(right, left, vars),
        right,
      );
    });

    // %{x: 1, y: 2} = %{x: 1, y: 3}
    it("some values in the left map don't match values in the right map", () => {
      const left = map;

      const right = Type.map([
        [Type.atom("x"), Type.integer(1)],
        [Type.atom("y"), Type.integer(3)],
      ]);

      assertMatchError(
        () => Interpreter.matchOperator(right, left, vars),
        right,
      );
    });

    // %{x: 1, y: 2} = :abc
    it("left map != right non-map", () => {
      const left = map;
      const right = Type.atom("abc");

      assertMatchError(
        () => Interpreter.matchOperator(right, left, vars),
        right,
      );
    });

    // {k: x, m: 2, n: z} = %{k: 1, m: 2, n: 3}
    it("left map has variables", () => {
      const left = Type.map([
        [Type.atom("k"), Type.variablePattern("x")],
        [Type.atom("m"), Type.integer(2)],
        [Type.atom("n"), Type.variablePattern("z")],
      ]);

      const right = Type.map([
        [Type.atom("k"), Type.integer(1)],
        [Type.atom("m"), Type.integer(2)],
        [Type.atom("n"), Type.integer(3)],
      ]);

      const result = Interpreter.matchOperator(right, left, vars);

      assert.deepStrictEqual(result, right);

      assert.deepStrictEqual(vars, {
        a: Type.integer(9),
        __matched__: {
          x: Type.integer(1),
          z: Type.integer(3),
        },
      });
    });

    // %{x: 1, y: 2} = %{}
    it("left is a non-empty map, right is an empty map", () => {
      const left = map;
      const right = emptyMap;

      assertMatchError(
        () => Interpreter.matchOperator(right, left, vars),
        right,
      );
    });

    // %{} = %{x: 1, y: 2}
    it("left is an empty map, right is a non-empty map", () => {
      const left = emptyMap;
      const right = map;
      const result = Interpreter.matchOperator(right, left, vars);

      assert.deepStrictEqual(result, right);
      assert.deepStrictEqual(vars, varsWithEmptyMatchedValues);
    });

    // %{} = %{}
    it("both left and right maps are empty", () => {
      const left = emptyMap;
      const right = emptyMap;
      const result = Interpreter.matchOperator(right, left, vars);

      assert.deepStrictEqual(result, right);
      assert.deepStrictEqual(vars, varsWithEmptyMatchedValues);
    });
  });

  // _var = 2
  it("match placeholder", () => {
    const result = Interpreter.matchOperator(
      Type.integer(2),
      Type.matchPlaceholder(),
      vars,
    );

    assert.deepStrictEqual(result, Type.integer(2));
    assert.deepStrictEqual(vars, varsWithEmptyMatchedValues);
  });

  describe("nested match operators", () => {
    it("x = 2 = 2", () => {
      const result = Interpreter.matchOperator(
        Interpreter.matchOperator(Type.integer(2), Type.integer(2), vars),
        Type.variablePattern("x"),
        vars,
      );

      assert.deepStrictEqual(result, Type.integer(2));

      assert.deepStrictEqual(vars, {
        a: Type.integer(9),
        __matched__: {
          x: Type.integer(2),
        },
      });
    });

    it("x = 2 = 3", () => {
      assertMatchError(
        () =>
          Interpreter.matchOperator(
            Interpreter.matchOperator(Type.integer(3), Type.integer(2), vars),
            Type.variablePattern("x"),
            vars,
          ),
        Type.integer(3),
      );
    });

    it("2 = x = 2", () => {
      const result = Interpreter.matchOperator(
        Interpreter.matchOperator(
          Type.integer(2),
          Type.variablePattern("x"),
          vars,
        ),
        Type.integer(2),
        vars,
      );

      assert.deepStrictEqual(result, Type.integer(2));

      assert.deepStrictEqual(vars, {
        a: Type.integer(9),
        __matched__: {
          x: Type.integer(2),
        },
      });
    });

    it("2 = x = 3", () => {
      assertMatchError(
        () =>
          Interpreter.matchOperator(
            Interpreter.matchOperator(
              Type.integer(3),
              Type.variablePattern("x"),
              vars,
            ),
            Type.integer(2),
            vars,
          ),
        Type.integer(3),
      );
    });

    it("2 = 2 = x, (x = 2)", () => {
      const vars = {
        a: Type.integer(9),
        x: Type.integer(2),
      };

      const result = Interpreter.matchOperator(
        Interpreter.matchOperator(vars.x, Type.integer(2), vars),
        Type.integer(2),
        vars,
      );

      assert.deepStrictEqual(result, Type.integer(2));

      assert.deepStrictEqual(vars, {
        a: Type.integer(9),
        x: Type.integer(2),
        __matched__: {},
      });
    });

    it("2 = 2 = x, (x = 3)", () => {
      const vars = {
        a: Type.integer(9),
        x: Type.integer(3),
      };

      assertMatchError(
        () =>
          Interpreter.matchOperator(
            Interpreter.matchOperator(vars.x, Type.integer(2), vars),
            Type.integer(2),
            vars,
          ),
        Type.integer(3),
      );
    });

    it("1 = 2 = x, (x = 2)", () => {
      const vars = {
        a: Type.integer(9),
        x: Type.integer(2),
      };

      assertMatchError(
        () =>
          Interpreter.matchOperator(
            Interpreter.matchOperator(vars.x, Type.integer(2), vars),
            Type.integer(1),
            vars,
          ),
        Type.integer(2),
      );
    });

    it("y = x + (x = 3) + x, (x = 11)", () => {
      const vars = {
        a: Type.integer(9),
        x: Type.integer(11),
      };

      const result = Interpreter.matchOperator(
        Erlang["+/2"](
          Erlang["+/2"](
            vars.x,
            Interpreter.matchOperator(
              Type.integer(3),
              Type.variablePattern("x"),
              vars,
            ),
          ),
          vars.x,
        ),
        Type.variablePattern("y"),
        vars,
      );

      assert.deepStrictEqual(result, Type.integer(25));

      assert.deepStrictEqual(vars, {
        a: Type.integer(9),
        x: Type.integer(11),
        __matched__: {
          x: Type.integer(3),
          y: Type.integer(25),
        },
      });
    });

    it("[1 = 1] = [1 = 1]", () => {
      const result = Interpreter.matchOperator(
        Type.list([
          Interpreter.matchOperator(Type.integer(1), Type.integer(1), vars),
        ]),
        Type.list([
          Interpreter.matchOperator(Type.integer(1), Type.integer(1), vars),
        ]),
        vars,
      );

      assert.deepStrictEqual(result, Type.list([Type.integer(1)]));
      assert.deepStrictEqual(vars, varsWithEmptyMatchedValues);
    });

    it("[1 = 1] = [1 = 2]", () => {
      assertMatchError(
        () =>
          Interpreter.matchOperator(
            Type.list([
              Interpreter.matchOperator(Type.integer(2), Type.integer(1), vars),
            ]),
            Type.list([
              Interpreter.matchOperator(Type.integer(1), Type.integer(1), vars),
            ]),
            vars,
          ),
        Type.integer(2),
      );
    });

    it("[1 = 1] = [2 = 1]", () => {
      assertMatchError(
        () =>
          Interpreter.matchOperator(
            Type.list([
              Interpreter.matchOperator(Type.integer(1), Type.integer(2), vars),
            ]),
            Type.list([
              Interpreter.matchOperator(Type.integer(1), Type.integer(1), vars),
            ]),
            vars,
          ),
        Type.integer(1),
      );
    });

    // TODO: JavaScript error message for this case is inconsistent with Elixir error message (see test/elixir/hologram/ex_js_consistency/match_operator_test.exs)
    it("[1 = 2] = [1 = 1]", () => {
      assertMatchError(
        () =>
          Interpreter.matchOperator(
            Type.list([
              Interpreter.matchOperator(Type.integer(1), Type.integer(1), vars),
            ]),
            Type.list([
              Interpreter.matchOperator(Type.integer(2), Type.integer(1), vars),
            ]),
            vars,
          ),
        Type.integer(2),
      );
    });

    // TODO: JavaScript error message for this case is inconsistent with Elixir error message (see test/elixir/hologram/ex_js_consistency/match_operator_test.exs)
    it("[2 = 1] = [1 = 1]", () => {
      assertMatchError(
        () =>
          Interpreter.matchOperator(
            Type.list([
              Interpreter.matchOperator(Type.integer(1), Type.integer(1), vars),
            ]),
            Type.list([
              Interpreter.matchOperator(Type.integer(1), Type.integer(2), vars),
            ]),
            vars,
          ),
        Type.integer(1),
      );
    });

    it("{a = b, 2, 3} = {1, c = d, 3} = {1, 2, e = f}", () => {
      const vars = {
        a: Type.integer(9),
        f: Type.integer(3),
      };

      const result = Interpreter.matchOperator(
        Interpreter.matchOperator(
          Type.tuple([
            Type.integer(1),
            Type.integer(2),
            Interpreter.matchOperator(vars.f, Type.variablePattern("e"), vars),
          ]),
          Type.tuple([
            Type.integer(1),
            Interpreter.matchOperator(
              Type.variablePattern("d"),
              Type.variablePattern("c"),
              vars,
            ),
            Type.integer(3),
          ]),
          vars,
        ),
        Type.tuple([
          Interpreter.matchOperator(
            Type.variablePattern("b"),
            Type.variablePattern("a"),
            vars,
          ),
          Type.integer(2),
          Type.integer(3),
        ]),
        vars,
      );

      assert.deepStrictEqual(
        result,
        Type.tuple([Type.integer(1), Type.integer(2), Type.integer(3)]),
      );

      assert.deepStrictEqual(vars, {
        a: Type.integer(9),
        f: Type.integer(3),
        __matched__: {
          a: Type.integer(1),
          b: Type.integer(1),
          c: Type.integer(2),
          d: Type.integer(2),
          e: Type.integer(3),
        },
      });
    });
  });

  describe("nested match pattern (with uresolved variables)", () => {
    it("[[a | b] = [c | d]] = [[1, 2, 3]]", () => {
      const result = Interpreter.matchOperator(
        Type.list([
          Type.list([Type.integer(1), Type.integer(2), Type.integer(3)]),
        ]),
        Type.list([
          Interpreter.matchOperator(
            Type.consPattern(
              Type.variablePattern("c"),
              Type.variablePattern("d"),
            ),
            Type.consPattern(
              Type.variablePattern("a"),
              Type.variablePattern("b"),
            ),
            vars,
          ),
        ]),
        vars,
      );

      assert.deepStrictEqual(
        result,
        Type.list([
          Type.list([Type.integer(1), Type.integer(2), Type.integer(3)]),
        ]),
      );

      assert.deepStrictEqual(vars, {
        a: Type.integer(9),
        __matched__: {
          a: Type.integer(1),
          b: Type.list([Type.integer(2), Type.integer(3)]),
          c: Type.integer(1),
          d: Type.list([Type.integer(2), Type.integer(3)]),
        },
      });
    });

    it("[[[a | b] = [c | d]] = [[e | f]]] = [[[1, 2, 3]]]", () => {
      const result = Interpreter.matchOperator(
        Type.list([
          Type.list([
            Type.list([Type.integer(1), Type.integer(2), Type.integer(3)]),
          ]),
        ]),
        Type.list([
          Interpreter.matchOperator(
            Type.list([
              Type.consPattern(
                Type.variablePattern("e"),
                Type.variablePattern("f"),
              ),
            ]),
            Type.list([
              Interpreter.matchOperator(
                Type.consPattern(
                  Type.variablePattern("c"),
                  Type.variablePattern("d"),
                ),
                Type.consPattern(
                  Type.variablePattern("a"),
                  Type.variablePattern("b"),
                ),
                vars,
              ),
            ]),
            vars,
          ),
        ]),
        vars,
      );

      assert.deepStrictEqual(
        result,
        Type.list([
          Type.list([
            Type.list([Type.integer(1), Type.integer(2), Type.integer(3)]),
          ]),
        ]),
      );

      assert.deepStrictEqual(vars, {
        a: Type.integer(9),
        __matched__: {
          a: Type.integer(1),
          b: Type.list([Type.integer(2), Type.integer(3)]),
          c: Type.integer(1),
          d: Type.list([Type.integer(2), Type.integer(3)]),
          e: Type.integer(1),
          f: Type.list([Type.integer(2), Type.integer(3)]),
        },
      });
    });

    it("[[a, b] = [c, d]] = [[1, 2]]", () => {
      const result = Interpreter.matchOperator(
        Type.list([Type.list([Type.integer(1), Type.integer(2)])]),
        Type.list([
          Interpreter.matchOperator(
            Type.list([Type.variablePattern("c"), Type.variablePattern("d")]),
            Type.list([Type.variablePattern("a"), Type.variablePattern("b")]),
            vars,
          ),
        ]),
        vars,
      );

      assert.deepStrictEqual(
        result,
        Type.list([Type.list([Type.integer(1), Type.integer(2)])]),
      );

      assert.deepStrictEqual(vars, {
        a: Type.integer(9),
        __matched__: {
          a: Type.integer(1),
          b: Type.integer(2),
          c: Type.integer(1),
          d: Type.integer(2),
        },
      });
    });

    it("[[[a, b] = [c, d]] = [[e, f]]] = [[[1, 2]]]", () => {
      const result = Interpreter.matchOperator(
        Type.list([Type.list([Type.list([Type.integer(1), Type.integer(2)])])]),
        Type.list([
          Interpreter.matchOperator(
            Type.list([
              Type.list([Type.variablePattern("e"), Type.variablePattern("f")]),
            ]),
            Type.list([
              Interpreter.matchOperator(
                Type.list([
                  Type.variablePattern("c"),
                  Type.variablePattern("d"),
                ]),
                Type.list([
                  Type.variablePattern("a"),
                  Type.variablePattern("b"),
                ]),
                vars,
              ),
            ]),
            vars,
          ),
        ]),
        vars,
      );

      assert.deepStrictEqual(
        result,
        Type.list([Type.list([Type.list([Type.integer(1), Type.integer(2)])])]),
      );

      assert.deepStrictEqual(vars, {
        a: Type.integer(9),
        __matched__: {
          a: Type.integer(1),
          b: Type.integer(2),
          c: Type.integer(1),
          d: Type.integer(2),
          e: Type.integer(1),
          f: Type.integer(2),
        },
      });
    });

    it("[x = y] = [1]", () => {
      const result = Interpreter.matchOperator(
        Type.list([Type.integer(1)]),
        Type.list([
          Interpreter.matchOperator(
            Type.variablePattern("y"),
            Type.variablePattern("x"),
            vars,
          ),
        ]),
        vars,
      );

      assert.deepStrictEqual(result, Type.list([Type.integer(1)]));

      assert.deepStrictEqual(vars, {
        a: Type.integer(9),
        __matched__: {
          x: Type.integer(1),
          y: Type.integer(1),
        },
      });
    });

    it("[1 = x] = [1]", () => {
      const result = Interpreter.matchOperator(
        Type.list([Type.integer(1)]),
        Type.list([
          Interpreter.matchOperator(
            Type.variablePattern("x"),
            Type.integer(1),
            vars,
          ),
        ]),
        vars,
      );

      assert.deepStrictEqual(result, Type.list([Type.integer(1)]));

      assert.deepStrictEqual(vars, {
        a: Type.integer(9),
        __matched__: {
          x: Type.integer(1),
        },
      });
    });

    it("[x = 1] = [1]", () => {
      const result = Interpreter.matchOperator(
        Type.list([Type.integer(1)]),
        Type.list([
          Interpreter.matchOperator(
            Type.integer(1),
            Type.variablePattern("x"),
            vars,
          ),
        ]),
        vars,
      );

      assert.deepStrictEqual(result, Type.list([Type.integer(1)]));

      assert.deepStrictEqual(vars, {
        a: Type.integer(9),
        __matched__: {
          x: Type.integer(1),
        },
      });
    });

    it("[x = y = z] = [1]", () => {
      const result = Interpreter.matchOperator(
        Type.list([Type.integer(1)]),
        Type.list([
          Interpreter.matchOperator(
            Interpreter.matchOperator(
              Type.variablePattern("z"),
              Type.variablePattern("y"),
              vars,
            ),
            Type.variablePattern("x"),
            vars,
          ),
        ]),
        vars,
      );

      assert.deepStrictEqual(result, Type.list([Type.integer(1)]));

      assert.deepStrictEqual(vars, {
        a: Type.integer(9),
        __matched__: {
          x: Type.integer(1),
          y: Type.integer(1),
          z: Type.integer(1),
        },
      });
    });

    it("[1 = x = y] = [1]", () => {
      const result = Interpreter.matchOperator(
        Type.list([Type.integer(1)]),
        Type.list([
          Interpreter.matchOperator(
            Interpreter.matchOperator(
              Type.variablePattern("y"),
              Type.variablePattern("x"),
              vars,
            ),
            Type.integer(1),
            vars,
          ),
        ]),
        vars,
      );

      assert.deepStrictEqual(result, Type.list([Type.integer(1)]));

      assert.deepStrictEqual(vars, {
        a: Type.integer(9),
        __matched__: {
          x: Type.integer(1),
          y: Type.integer(1),
        },
      });
    });

    it("[x = 1 = y] = [1]", () => {
      const result = Interpreter.matchOperator(
        Type.list([Type.integer(1)]),
        Type.list([
          Interpreter.matchOperator(
            Interpreter.matchOperator(
              Type.variablePattern("y"),
              Type.integer(1),
              vars,
            ),
            Type.variablePattern("x"),
            vars,
          ),
        ]),
        vars,
      );

      assert.deepStrictEqual(result, Type.list([Type.integer(1)]));

      assert.deepStrictEqual(vars, {
        a: Type.integer(9),
        __matched__: {
          x: Type.integer(1),
          y: Type.integer(1),
        },
      });
    });

    it("[x = y = 1] = [1]", () => {
      const result = Interpreter.matchOperator(
        Type.list([Type.integer(1)]),
        Type.list([
          Interpreter.matchOperator(
            Interpreter.matchOperator(
              Type.integer(1),
              Type.variablePattern("y"),
              vars,
            ),
            Type.variablePattern("x"),
            vars,
          ),
        ]),
        vars,
      );

      assert.deepStrictEqual(result, Type.list([Type.integer(1)]));

      assert.deepStrictEqual(vars, {
        a: Type.integer(9),
        __matched__: {
          x: Type.integer(1),
          y: Type.integer(1),
        },
      });
    });

    it("[v = x = y = z] = [1]", () => {
      const result = Interpreter.matchOperator(
        Type.list([Type.integer(1)]),
        Type.list([
          Interpreter.matchOperator(
            Interpreter.matchOperator(
              Interpreter.matchOperator(
                Type.variablePattern("z"),
                Type.variablePattern("y"),
                vars,
              ),
              Type.variablePattern("x"),
              vars,
            ),
            Type.variablePattern("v"),
            vars,
          ),
        ]),
        vars,
      );

      assert.deepStrictEqual(result, Type.list([Type.integer(1)]));

      assert.deepStrictEqual(vars, {
        a: Type.integer(9),
        __matched__: {
          v: Type.integer(1),
          x: Type.integer(1),
          y: Type.integer(1),
          z: Type.integer(1),
        },
      });
    });

    it("[1 = x = y = z] = [1]", () => {
      const result = Interpreter.matchOperator(
        Type.list([Type.integer(1)]),
        Type.list([
          Interpreter.matchOperator(
            Interpreter.matchOperator(
              Interpreter.matchOperator(
                Type.variablePattern("z"),
                Type.variablePattern("y"),
                vars,
              ),
              Type.variablePattern("x"),
              vars,
            ),
            Type.integer(1),
            vars,
          ),
        ]),
        vars,
      );

      assert.deepStrictEqual(result, Type.list([Type.integer(1)]));

      assert.deepStrictEqual(vars, {
        a: Type.integer(9),
        __matched__: {
          x: Type.integer(1),
          y: Type.integer(1),
          z: Type.integer(1),
        },
      });
    });

    it("[x = 1 = y = z] = [1]", () => {
      const result = Interpreter.matchOperator(
        Type.list([Type.integer(1)]),
        Type.list([
          Interpreter.matchOperator(
            Interpreter.matchOperator(
              Interpreter.matchOperator(
                Type.variablePattern("z"),
                Type.variablePattern("y"),
                vars,
              ),
              Type.integer(1),
              vars,
            ),
            Type.variablePattern("x"),
            vars,
          ),
        ]),
        vars,
      );

      assert.deepStrictEqual(result, Type.list([Type.integer(1)]));

      assert.deepStrictEqual(vars, {
        a: Type.integer(9),
        __matched__: {
          x: Type.integer(1),
          y: Type.integer(1),
          z: Type.integer(1),
        },
      });
    });

    it("[x = y = 1 = z] = [1]", () => {
      const result = Interpreter.matchOperator(
        Type.list([Type.integer(1)]),
        Type.list([
          Interpreter.matchOperator(
            Interpreter.matchOperator(
              Interpreter.matchOperator(
                Type.variablePattern("z"),
                Type.integer(1),
                vars,
              ),
              Type.variablePattern("y"),
              vars,
            ),
            Type.variablePattern("x"),
            vars,
          ),
        ]),
        vars,
      );

      assert.deepStrictEqual(result, Type.list([Type.integer(1)]));

      assert.deepStrictEqual(vars, {
        a: Type.integer(9),
        __matched__: {
          x: Type.integer(1),
          y: Type.integer(1),
          z: Type.integer(1),
        },
      });
    });

    it("[x = y = z = 1] = [1]", () => {
      const result = Interpreter.matchOperator(
        Type.list([Type.integer(1)]),
        Type.list([
          Interpreter.matchOperator(
            Interpreter.matchOperator(
              Interpreter.matchOperator(
                Type.integer(1),
                Type.variablePattern("z"),
                vars,
              ),
              Type.variablePattern("y"),
              vars,
            ),
            Type.variablePattern("x"),
            vars,
          ),
        ]),
        vars,
      );
      assert.deepStrictEqual(result, Type.list([Type.integer(1)]));

      assert.deepStrictEqual(vars, {
        a: Type.integer(9),
        __matched__: {
          x: Type.integer(1),
          y: Type.integer(1),
          z: Type.integer(1),
        },
      });
    });

    it("[x = y = z] = [a = b = c = 2]", () => {
      const result = Interpreter.matchOperator(
        Type.list([
          Interpreter.matchOperator(
            Interpreter.matchOperator(
              Interpreter.matchOperator(
                Type.integer(2),
                Type.variablePattern("c"),
                vars,
              ),
              Type.variablePattern("b"),
              vars,
            ),
            Type.variablePattern("a"),
            vars,
          ),
        ]),
        Type.list([
          Interpreter.matchOperator(
            Interpreter.matchOperator(
              Type.variablePattern("z"),
              Type.variablePattern("y"),
              vars,
            ),
            Type.variablePattern("x"),
            vars,
          ),
        ]),
        vars,
      );

      assert.deepStrictEqual(result, Type.list([Type.integer(2)]));

      assert.deepStrictEqual(vars, {
        a: Type.integer(9),
        __matched__: {
          a: Type.integer(2),
          b: Type.integer(2),
          c: Type.integer(2),
          x: Type.integer(2),
          y: Type.integer(2),
          z: Type.integer(2),
        },
      });
    });

    it("%{x: %{a: a, b: b} = %{a: c, b: d}} = %{x: %{a: 1, b: 2}}", () => {
      const result = Interpreter.matchOperator(
        Type.map([
          [
            Type.atom("x"),
            Type.map([
              [Type.atom("a"), Type.integer(1)],
              [Type.atom("b"), Type.integer(2)],
            ]),
          ],
        ]),
        Type.map([
          [
            Type.atom("x"),
            Interpreter.matchOperator(
              Type.map([
                [Type.atom("a"), Type.variablePattern("c")],
                [Type.atom("b"), Type.variablePattern("d")],
              ]),
              Type.map([
                [Type.atom("a"), Type.variablePattern("a")],
                [Type.atom("b"), Type.variablePattern("b")],
              ]),
              vars,
            ),
          ],
        ]),
        vars,
      );

      assert.deepStrictEqual(
        result,
        Type.map([
          [
            Type.atom("x"),
            Type.map([
              [Type.atom("a"), Type.integer(1)],
              [Type.atom("b"), Type.integer(2)],
            ]),
          ],
        ]),
      );

      assert.deepStrictEqual(vars, {
        a: Type.integer(9),
        __matched__: {
          a: Type.integer(1),
          b: Type.integer(2),
          c: Type.integer(1),
          d: Type.integer(2),
        },
      });
    });

    it("%{y: %{x: %{a: a, b: b} = %{a: c, b: d}} = %{x: %{a: e, b: f}}} = %{y: %{x: %{a: 1, b: 2}}}", () => {
      const result = Interpreter.matchOperator(
        Type.map([
          [
            Type.atom("y"),
            Type.map([
              [
                Type.atom("x"),
                Type.map([
                  [Type.atom("a"), Type.integer(1)],
                  [Type.atom("b"), Type.integer(2)],
                ]),
              ],
            ]),
          ],
        ]),
        Type.map([
          [
            Type.atom("y"),
            Interpreter.matchOperator(
              Type.map([
                [
                  Type.atom("x"),
                  Type.map([
                    [Type.atom("a"), Type.variablePattern("e")],
                    [Type.atom("b"), Type.variablePattern("f")],
                  ]),
                ],
              ]),
              Type.map([
                [
                  Type.atom("x"),
                  Interpreter.matchOperator(
                    Type.map([
                      [Type.atom("a"), Type.variablePattern("c")],
                      [Type.atom("b"), Type.variablePattern("d")],
                    ]),
                    Type.map([
                      [Type.atom("a"), Type.variablePattern("a")],
                      [Type.atom("b"), Type.variablePattern("b")],
                    ]),
                    vars,
                  ),
                ],
              ]),
              vars,
            ),
          ],
        ]),
        vars,
      );

      assert.deepStrictEqual(
        result,
        Type.map([
          [
            Type.atom("y"),
            Type.map([
              [
                Type.atom("x"),
                Type.map([
                  [Type.atom("a"), Type.integer(1)],
                  [Type.atom("b"), Type.integer(2)],
                ]),
              ],
            ]),
          ],
        ]),
      );

      assert.deepStrictEqual(vars, {
        a: Type.integer(9),
        __matched__: {
          a: Type.integer(1),
          b: Type.integer(2),
          c: Type.integer(1),
          d: Type.integer(2),
          e: Type.integer(1),
          f: Type.integer(2),
        },
      });
    });

    it("{{a, b} = {c, d}} = {{1, 2}}", () => {
      const result = Interpreter.matchOperator(
        Type.tuple([Type.tuple([Type.integer(1), Type.integer(2)])]),
        Type.tuple([
          Interpreter.matchOperator(
            Type.tuple([Type.variablePattern("c"), Type.variablePattern("d")]),
            Type.tuple([Type.variablePattern("a"), Type.variablePattern("b")]),
            vars,
          ),
        ]),
        vars,
      );

      assert.deepStrictEqual(
        result,
        Type.tuple([Type.tuple([Type.integer(1), Type.integer(2)])]),
      );

      assert.deepStrictEqual(vars, {
        a: Type.integer(9),
        __matched__: {
          a: Type.integer(1),
          b: Type.integer(2),
          c: Type.integer(1),
          d: Type.integer(2),
        },
      });
    });

    it("{{{a, b} = {c, d}} = {{e, f}}} = {{{1, 2}}}", () => {
      const result = Interpreter.matchOperator(
        Type.tuple([
          Type.tuple([Type.tuple([Type.integer(1), Type.integer(2)])]),
        ]),
        Type.tuple([
          Interpreter.matchOperator(
            Type.tuple([
              Type.tuple([
                Type.variablePattern("e"),
                Type.variablePattern("f"),
              ]),
            ]),
            Type.tuple([
              Interpreter.matchOperator(
                Type.tuple([
                  Type.variablePattern("c"),
                  Type.variablePattern("d"),
                ]),
                Type.tuple([
                  Type.variablePattern("a"),
                  Type.variablePattern("b"),
                ]),
                vars,
              ),
            ]),
            vars,
          ),
        ]),
        vars,
      );

      assert.deepStrictEqual(
        result,
        Type.tuple([
          Type.tuple([Type.tuple([Type.integer(1), Type.integer(2)])]),
        ]),
      );

      assert.deepStrictEqual(vars, {
        a: Type.integer(9),
        __matched__: {
          a: Type.integer(1),
          b: Type.integer(2),
          c: Type.integer(1),
          d: Type.integer(2),
          e: Type.integer(1),
          f: Type.integer(2),
        },
      });
    });
  });

  // TODO: finish overhaul, remember about Elixir consistency tests
  // describe("tuple type", () => {
  //   let tuple1;
  //   beforeEach(() => {
  //     tuple1 = Type.tuple([Type.integer(1), Type.integer(2)]);
  //   });
  //   it("{1, 2} = {1, 2}", () => {
  //     const result = Interpreter.matchOperator(tuple1, tuple1, vars);
  //     assert.deepStrictEqual(result, tuple1);
  //     assert.deepStrictEqual(vars, {a: Type.integer(9)});
  //   });
  //   it("{1, 2} = {1, 3}", () => {
  //     const tuple2 = Type.tuple([Type.integer(1), Type.integer(3)]);
  //     assertMatchError(
  //       () => Interpreter.matchOperator(tuple2, tuple1, vars),
  //       tuple2,
  //     );
  //   });
  //   it("{1, 2} = :abc", () => {
  //     const myAtom = Type.atom("abc");
  //     assertMatchError(
  //       () => Interpreter.matchOperator(myAtom, tuple1, vars),
  //       myAtom,
  //     );
  //   });
  //   it("{} = {1, 2}", () => {
  //     assertMatchError(
  //       () => Interpreter.matchOperator(tuple1, Type.tuple([]), vars),
  //       tuple1,
  //     );
  //   });
  //   it("{1, 2} = {}", () => {
  //     const emptyTuple = Type.tuple([]);
  //     assertMatchError(
  //       () => Interpreter.matchOperator(emptyTuple, tuple1, vars),
  //       emptyTuple,
  //     );
  //   });
  //   it("{} = {}", () => {
  //     const emptyTuple = Type.tuple([]);
  //     const result = Interpreter.matchOperator(emptyTuple, emptyTuple, vars);
  //     assert.deepStrictEqual(result, emptyTuple);
  //     assert.deepStrictEqual(vars, {a: Type.integer(9)});
  //   });
  //   it("{x, 2, y} = {1, 2, 3}", () => {
  //     const left = Type.tuple([
  //       Type.variablePattern("x"),
  //       Type.integer(2),
  //       Type.variablePattern("y"),
  //     ]);
  //     const right = Type.tuple([
  //       Type.integer(1),
  //       Type.integer(2),
  //       Type.integer(3),
  //     ]);
  //     const result = Interpreter.matchOperator(right, left, vars);
  //     assert.deepStrictEqual(result, right);
  //     const expectedVars = {
  //       a: Type.integer(9),
  //       x: Type.integer(1),
  //       y: Type.integer(3),
  //     };
  //     assert.deepStrictEqual(vars, expectedVars);
  //   });
  // });

  describe("variable pattern", () => {
    // x = 2
    it("variable pattern == anything", () => {
      const result = Interpreter.matchOperator(
        Type.integer(2),
        Type.variablePattern("x"),
        vars,
      );

      assert.deepStrictEqual(result, Type.integer(2));

      assert.deepStrictEqual(vars, {
        a: Type.integer(9),
        __matched__: {
          x: Type.integer(2),
        },
      });
    });

    // [x, x] = [1, 1]
    it("multiple variables with the same name being matched to the same value", () => {
      const result = Interpreter.matchOperator(
        Type.list([Type.integer(1), Type.integer(1)]),
        Type.list([Type.variablePattern("x"), Type.variablePattern("x")]),
        vars,
      );

      assert.deepStrictEqual(
        result,
        Type.list([Type.integer(1), Type.integer(1)]),
      );

      assert.deepStrictEqual(vars, {
        a: Type.integer(9),
        __matched__: {
          x: Type.integer(1),
        },
      });
    });

    // [x, x] = [1, 2]
    it("multiple variables with the same name being matched to the different values", () => {
      const left = Type.list([
        Type.variablePattern("x"),
        Type.variablePattern("x"),
      ]);

      const right = Type.list([Type.integer(1), Type.integer(2)]);

      assertMatchError(
        () => Interpreter.matchOperator(right, left, vars),
        right,
      );
    });
  });
});

it("module()", () => {
  assert.equal(Interpreter.module("maps"), Erlang_Maps);
});

describe("moduleName()", () => {
  describe("boxed alias argument", () => {
    it("Elixir module alias without camel case segments", () => {
      const alias = Type.atom("Elixir.Aaa.Bbb.Ccc");
      const result = Interpreter.moduleName(alias);

      assert.equal(result, "Elixir_Aaa_Bbb_Ccc");
    });

    it("Elixir module alias with camel case segments", () => {
      const alias = Type.atom("Elixir.AaaBbb.CccDdd");
      const result = Interpreter.moduleName(alias);

      assert.equal(result, "Elixir_AaaBbb_CccDdd");
    });

    it(":erlang alias", () => {
      const alias = Type.atom("erlang");
      const result = Interpreter.moduleName(alias);

      assert.equal(result, "Erlang");
    });

    it("single-segment Erlang module alias", () => {
      const alias = Type.atom("aaa");
      const result = Interpreter.moduleName(alias);

      assert.equal(result, "Erlang_Aaa");
    });

    it("multiple-segment Erlang module alias", () => {
      const alias = Type.atom("aaa_bbb");
      const result = Interpreter.moduleName(alias);

      assert.equal(result, "Erlang_Aaa_Bbb");
    });
  });

  describe("JS string argument", () => {
    it("Elixir module alias without camel case segments", () => {
      const result = Interpreter.moduleName("Elixir.Aaa.Bbb.Ccc");
      assert.equal(result, "Elixir_Aaa_Bbb_Ccc");
    });

    it("Elixir module alias with camel case segments", () => {
      const result = Interpreter.moduleName("Elixir.AaaBbb.CccDdd");
      assert.equal(result, "Elixir_AaaBbb_CccDdd");
    });

    it(":erlang alias", () => {
      const result = Interpreter.moduleName("erlang");
      assert.equal(result, "Erlang");
    });

    it("single-segment Erlang module alias", () => {
      const result = Interpreter.moduleName("aaa");
      assert.equal(result, "Erlang_Aaa");
    });

    it("multiple-segment Erlang module alias", () => {
      const result = Interpreter.moduleName("aaa_bbb");
      assert.equal(result, "Erlang_Aaa_Bbb");
    });
  });
});

it("raiseArgumentError()", () => {
  assertBoxedError(
    () => Interpreter.raiseArgumentError("abc"),
    "ArgumentError",
    "abc",
  );
});

it("raiseBadMapError()", () => {
  assertBoxedError(
    () => Interpreter.raiseBadMapError(Type.atom("abc")),
    "BadMapError",
    "expected a map, got: :abc",
  );
});

it("raiseCaseClauseError()", () => {
  assertBoxedError(
    () => Interpreter.raiseCaseClauseError(Type.atom("abc")),
    "CaseClauseError",
    "no case clause matching: :abc",
  );
});

it("raiseCompileError()", () => {
  assertBoxedError(
    () => Interpreter.raiseCompileError("abc"),
    "CompileError",
    "abc",
  );
});

it("raiseError()", () => {
  assertBoxedError(
    () => Interpreter.raiseError("Aaa.Bbb", "abc"),
    "Aaa.Bbb",
    "abc",
  );
});

it("raiseFunctionClauseError()", () => {
  assertBoxedError(
    () => Interpreter.raiseFunctionClauseError("abc"),
    "FunctionClauseError",
    "abc",
  );
});

it("raiseKeyError()", () => {
  assertBoxedError(() => Interpreter.raiseKeyError("abc"), "KeyError", "abc");
});

it("raiseMatchError()", () => {
  assertBoxedError(
    () => Interpreter.raiseMatchError(Type.atom("abc")),
    "MatchError",
    "no match of right hand side value: :abc",
  );
});

describe("serialize()", () => {
  it("serializes number to JSON", () => {
    assert.equal(Interpreter.serialize(123), "123");
  });

  it("serializes string to JSON", () => {
    assert.equal(Interpreter.serialize("abc"), '"abc"');
  });

  it("serializes non-negative bigint to JSON", () => {
    assert.equal(Interpreter.serialize(123n), '"__bigint__:123"');
  });

  it("serializes negative bigint to JSON", () => {
    assert.equal(Interpreter.serialize(-123n), '"__bigint__:-123"');
  });

  it("serializes non-nested object to JSON", () => {
    assert.equal(Interpreter.serialize({a: 1, b: 2}), '{"a":1,"b":2}');
  });

  it("serializes nested object to JSON", () => {
    const term = {a: 1, b: 2, c: {d: 3, e: 4}};
    const expected = '{"a":1,"b":2,"c":{"d":3,"e":4}}';

    assert.equal(Interpreter.serialize(term), expected);
  });
});

describe("try()", () => {
  let vars;

  beforeEach(() => {
    vars = {
      a: Type.integer(1),
      b: Type.integer(2),
    };
  });

  it("body without any errors, throws or exists / vars are not mutated in body", () => {
    // try do
    //   a = 3
    //   :ok
    // end
    const body = (vars) => {
      Interpreter.matchOperator(
        Type.integer(3n),
        Type.variablePattern("a"),
        vars,
      );
      return Type.atom("ok");
    };

    const result = Interpreter.try(body, [], [], [], null, vars);

    assert.deepStrictEqual(result, Type.atom("ok"));
    assert.deepStrictEqual(vars.a, Type.integer(1));
  });
});

it("updateVarsToMatchedValues()", () => {
  const vars = {
    a: 1,
    b: 2,
    c: 3,
    __matched__: {
      d: 4,
      a: 11,
      e: 5,
      c: 33,
    },
  };

  const result = Interpreter.updateVarsToMatchedValues(vars);

  const expected = {
    a: 11,
    b: 2,
    c: 33,
    d: 4,
    e: 5,
  };

  assert.equal(result, vars);
  assert.deepStrictEqual(result, expected);
});

// TODO: finish implementing
it("with()", () => {
  assert.throw(
    () => Interpreter.with(),
    Error,
    '"with" expression is not yet implemented in Hologram',
  );
});
