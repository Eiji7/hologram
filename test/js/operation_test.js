"use strict";

import { assert } from "./support/commons";
import Operation from "../../assets/js/hologram/operation"
import Type from "../../assets/js/hologram/type"

describe("buildMethod()", () => {
  it("returns command enum value if the modifiers in operation spec include 'command'", () => {
    const operationSpec = {
      modifiers: ["command"]
    }

    const result = Operation.buildMethod(operationSpec)
    const expected = Operation.METHOD.command

    assert.equal(result, expected)
  })

  it("returns action enum value if the modifiers in operation spec don't include 'command'", () => {
    const operationSpec = {
      modifiers: ["command8888"]
    }

    const result = Operation.buildMethod(operationSpec)
    const expected = Operation.METHOD.action

    assert.equal(result, expected)
  })
})

describe("buildTarget()", () => {
  const bindings = Type.map({})
  const source = "test_source"

  it("returns the source arg if the operation spec doesn't contain target value", () => {
    const operationSpec = {
      value: [Type.textNode("test")]
    }

    const result = Operation.buildTarget(operationSpec, source, bindings)

    assert.equal(result, source)
  })

  it("returns layout enum value if the operation spec target value is equal to 'layout' boxed atom", () => {
    const callback = (_$bindings) => { return Type.tuple([Type.atom("layout"), Type.atom("test_action")]) }

    const operationSpec = {
      value: [Type.expressionNode(callback)]
    }

    const result = Operation.buildTarget(operationSpec, source, bindings)
    const expected = Operation.TARGET.layout

    assert.equal(result, expected)
  })

  it("returns page enum value if the operation spec target value is equal to 'page' boxed atom", () => {
    const callback = (_$bindings) => { return Type.tuple([Type.atom("page"), Type.atom("test_action")]) }

    const operationSpec = {
      value: [Type.expressionNode(callback)]
    }

    const result = Operation.buildTarget(operationSpec, source, bindings)
    const expected = Operation.TARGET.page

    assert.equal(result, expected)
  })

  it("returns unboxed target value if the operation spec contains boxed target value", () => {
    const callback = (_$bindings) => { return Type.tuple([Type.atom("test_target"), Type.atom("test_action")]) }

    const operationSpec = {
      value: [Type.expressionNode(callback)]
    }

    const result = Operation.buildTarget(operationSpec, source, bindings)
    const expected = "test_target"

    assert.equal(result, expected)
  })
})

describe("getSpecType()", () => {
  it("returns expression enum value if the operation spec value is an expression node", () => {
    const operationSpec = {
      value: [Type.expressionNode(null)]
    }

    const result = Operation.getSpecType(operationSpec)
    const expected = Operation.SPEC_TYPE.expression

    assert.equal(result, expected)
  })

  it("returns text enum value if the operation spec value is a text node", () => {
    const operationSpec = {
      value: [Type.textNode("test")]
    }

    const result = Operation.getSpecType(operationSpec)
    const expected = Operation.SPEC_TYPE.text

    assert.equal(result, expected)
  })
})

describe("getTargetValue()", () => {
  const bindings = Type.map({})

  it("returns null if the operation spec is of text type", () => {
    const operationSpec = {
      value: [Type.textNode("test")]
    }

    const result = Operation.getTargetValue(operationSpec, bindings)

    assert.isNull(result)
  })

  it("returns null if the operation spec has only one elem", () => {
    const callback = (_$bindings) => { return Type.tuple([Type.atom("layout")]) }

    const operationSpec = {
      value: [Type.expressionNode(callback)]
    }

    const result = Operation.getTargetValue(operationSpec, bindings)

    assert.isNull(result)
  })

  it("returns null if the second operation spec elem is not a boxed atom", () => {
    const callback = (_$bindings) => {
      return Type.tuple([Type.atom("layout"), Type.integer(1)]) 
    }

    const operationSpec = {
      value: [Type.expressionNode(callback)]
    }

    const result = Operation.getTargetValue(operationSpec, bindings)

    assert.isNull(result)
  })

  it("returns unboxed target value if the operation spec contains it", () => {
    const callback = (_$bindings) => {
      return Type.tuple([Type.atom("test_target"), Type.atom("test_action")]) 
    }

    const operationSpec = {
      value: [Type.expressionNode(callback)]
    }

    const result = Operation.getTargetValue(operationSpec, bindings)

    assert.equal(result, "test_target")
  })
})