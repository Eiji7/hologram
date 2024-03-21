"use strict";

import { HologramNotImplementedError } from "./errors";
import Enum from "./elixir/enum"
import Kernel from "./elixir/kernel"
import List from "./elixir/list";
import Map from "./elixir/map"
import Type from "./type"
import Utils from "./utils"

export default class Interpreter {
  static $case_expression(condition, clausesAnonFun) {
    const result = clausesAnonFun(condition)
    return Utils.freeze(result)
  }

  static $cons_operator(head, tail) {
    return List.insert_at(tail, 0, head)
  }

  static $dot_operator(left, right) {
    return left.data[Type.encodedKey(right)]
  }

  static $if_expression(condition, doClause, elseClause) {
    let result;

    if (Type.isTruthy(condition())) {
      result = doClause()
    } else {
      result = elseClause()
    }

    return Utils.freeze(result)
  }

  static isConsOperatorPatternMatched(left, right) {
    if (right.type !== 'list') {
      return false
    }

    if (right.data.length === 0) {
      return false
    }

    if (!Interpreter.isPatternMatched(left.head, Kernel.hd(right))) {
      return false
    }

    if (!Interpreter.isPatternMatched(left.tail, Kernel.tl(right))) {
      return false
    }

    return true
  }

  static isEnumPatternMatched(left, right) {
    if (left.data.length !== right.data.length) {
      return false;
    }

    for (let i = 0; i < left.data.length; ++i) {
      if (!Interpreter.isPatternMatched(left.data[i], right.data[i])) {
        return false
      }
    }

    return true
  }

  static isFunctionArgsPatternMatched(params, args) {
    if (args.length !== params.length) {
      return false;
    }

    for (let i = 0; i < args.length; ++ i) {
      if (!Interpreter.isPatternMatched(params[i], args[i])) {
        return false;
      }
    }

    return true;
  }

  static isMapPatternMatched(left, right) {
    for (const key of Map.keys(left).data) {
      if (Map.has_key$question(right, key)) {
        if (!Interpreter.isPatternMatched(Map.get(left, key), Map.get(right, key))) {
          return false
        }
      } else {
        return false
      }
    }

    return true 
  }

  static isPatternMatched(left, right) {
    const lType = left.type;
    const rType = right.type;

    if (lType === "placeholder") {
      return true;
    }

    if (lType === 'cons_operator_pattern') {
      return Interpreter.isConsOperatorPatternMatched(left, right)
    }

    if (lType !== rType) {
      return false;
    }

    switch (lType) {
      case "atom":
      case "integer":
        return left.value === right.value;

      case "list":
      case "tuple":
        return Interpreter.isEnumPatternMatched(left, right)        

      case "map":
        return Interpreter.isMapPatternMatched(left, right)

      default:
        const message = `Interpreter.isPatternMatched(): left = ${JSON.stringify(left)}`
        throw new HologramNotImplementedError(message)
    }
  }

  // TODO: take into account other types (for now it works for integers and floats only)
  static $less_than_operator(left, right) {
    if (!Type.isNumber(left)) {
      const message = `Interpreter.$less_than_operator(): left = ${JSON.stringify(left)}`
      throw new HologramNotImplementedError(message)
    }

    if (!Type.isNumber(right)) {
      const message = `Interpreter.$less_than_operator(): right = ${JSON.stringify(right)}`
      throw new HologramNotImplementedError(message)
    }

    return Type.boolean(left.value < right.value)
  }

  static $membership_operator(left, right) {
    return Enum.member$question(right, left)
  }

  static $multiplication_operator(left, right) {
    const type = left.type === "integer" && right.type === "integer" ? "integer" : "float"
    const result = left.value * right.value
    return Utils.freeze({type: type, value: result})
  }

  static $not_equal_to_operator(left, right) {
    const isEqualTo = Interpreter.$equal_to_operator(left, right)
    return Type.boolean(!isEqualTo.value)
  }

  static $relaxed_boolean_and_operator(left, right) {
    if (Type.isTruthy(left)) {
      return right
    } else {
      return left
    }
  }

  static $relaxed_boolean_not_operator(value) {
    if (Type.isFalsy(value)) {
      return Type.boolean(true)
    } else {
      return Type.boolean(false)
    }
  }

  static $relaxed_boolean_or_operator(left, right) {
    if (Type.isTruthy(left)) {
      return left
    } else {
      return right
    }
  }

  static $subtraction_operator(left, right) {
    const type = left.type === "integer" && right.type === "integer" ? "integer" : "float"
    const result = left.value - right.value
    return Utils.freeze({type: type, value: result})
  }

  static $type_operator(value, type) {
    if (Type.isString(value) && type === "binary") {
      return value
    } else {
      const message = `Interpreter.$type_operator(): value = ${JSON.stringify(value)}, type = ${JSON.stringify(type)}`
      throw new HologramNotImplementedError(message)
    }
  }

  static $unary_negative_operator(boxedValue) {
    return Utils.freeze({type: boxedValue.type, value: -boxedValue.value})
  }
}