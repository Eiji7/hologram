"use strict";

import Interpreter from "./interpreter.mjs";
import Type from "./type.mjs";

export default class Hologram {
  static Interpreter = Interpreter;
  static Type = Type;

  static deserialize(json) {
    return JSON.parse(json, (_key, value) => {
      if (typeof value === "string" && /^__bigint__:-?\d+$/.test(value)) {
        return BigInt(value.substring(11, value.length));
      }
      return value;
    });
  }

  static inspect(term) {
    return Elixir_Kernel["inspect/2"](term, Type.list([]));
  }

  static inspectModuleName(moduleName) {
    if (moduleName.startsWith("Elixir_")) {
      return moduleName.slice(7).replace("_", ".");
    }

    if (moduleName === "Erlang") {
      return ":erlang";
    }

    // starts with "Erlang_"
    return ":" + moduleName.slice(7).toLowerCase();
  }

  static module(alias) {
    return globalThis[Hologram.moduleName(alias)];
  }

  static moduleName(alias) {
    const aliasStr = Type.isAtom(alias) ? alias.value : alias;
    let prefixedAliasStr;

    if (aliasStr === "erlang") {
      prefixedAliasStr = "Erlang";
    } else {
      prefixedAliasStr =
        aliasStr.charAt(0).toLowerCase() === aliasStr.charAt(0)
          ? "Erlang_" + aliasStr
          : aliasStr;
    }

    return prefixedAliasStr.replace(/\./g, "_");
  }

  static raiseArgumentError(message) {
    return Hologram.raiseError("ArgumentError", message);
  }

  static raiseBadMapError(message) {
    return Hologram.raiseError("BadMapError", message);
  }

  static raiseCompileError(message) {
    return Hologram.raiseError("CompileError", message);
  }

  static raiseError(aliasStr, message) {
    const errorStruct = Type.errorStruct(aliasStr, message);
    return Erlang["error/1"](errorStruct);
  }

  static raiseInterpreterError(message) {
    return Hologram.raiseError("Hologram.InterpreterError", message);
  }

  static raiseKeyError(message) {
    return Hologram.raiseError("KeyError", message);
  }

  static serialize(term) {
    return JSON.stringify(term, (_key, value) =>
      typeof value === "bigint" ? `__bigint__:${value.toString()}` : value,
    );
  }
}
