"use strict";

import Type from "../type"
import Utils from "../utils"

export default class ClickEvent {
  // TODO: implement & test (return boxed map)
  static buildEventData(_event, _tag) {
    return Utils.freeze(Type.map())
  }

  // DEFER: test
  // see: https://stackoverflow.com/a/20087506/13040586
  static shouldHandleEvent(event) {
    if (event.ctrlKey || event.metaKey || event.shiftKey || event.button === 1) {
      return false
    }
    
    return true
  }
}