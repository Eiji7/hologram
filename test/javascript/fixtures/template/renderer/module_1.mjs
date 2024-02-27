"use strict";

import Interpreter from "../../../../../assets/js/interpreter.mjs";
import Type from "../../../../../assets/js/type.mjs";

export function defineModule1Fixture() {
  Interpreter.defineElixirFunction(
    "Elixir_Hologram_Test_Fixtures_Template_Renderer_Module1",
    "__props__",
    0,
    [
      {
        params: (_vars) => [],
        guards: [],
        body: (_vars) => {
          return Type.list([]);
        },
      },
    ],
  );

  Interpreter.defineElixirFunction(
    "Elixir_Hologram_Test_Fixtures_Template_Renderer_Module1",
    "init",
    2,
    [
      {
        params: (_vars) => [
          Type.matchPlaceholder(),
          Type.variablePattern("component"),
        ],
        guards: [],
        body: (vars) => {
          return vars.component;
        },
      },
    ],
  );

  Interpreter.defineElixirFunction(
    "Elixir_Hologram_Test_Fixtures_Template_Renderer_Module1",
    "template",
    0,
    [
      {
        params: (_vars) => [],
        guards: [],
        body: (vars) => {
          globalThis.__hologramReturn__ = Type.anonymousFunction(
            1,
            [
              {
                params: (_vars) => [Type.variablePattern("vars")],
                guards: [],
                body: (vars) => {
                  Interpreter.matchOperator(
                    vars.vars,
                    Type.matchPlaceholder(),
                    vars,
                  );
                  Interpreter.updateVarsToMatchedValues(vars);
                  return Type.list([
                    Type.tuple([
                      Type.atom("element"),
                      Type.bitstring("div"),
                      Type.list([]),
                      Type.list([
                        Type.tuple([Type.atom("text"), Type.bitstring("abc")]),
                      ]),
                    ]),
                  ]);
                },
              },
            ],
            vars,
          );
          Interpreter.updateVarsToMatchedValues(vars);
          return globalThis.__hologramReturn__;
        },
      },
    ],
  );
}
