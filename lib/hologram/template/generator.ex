defmodule Hologram.Template.Generator do
  alias Hologram.Template.VirtualDOM.{Expression, ElementNode, TextNode}
  alias Hologram.Template.{ExpressionGenerator, NodeListGenerator, ElementNodeGenerator, TextNodeGenerator}

  def generate(virtual_dom, context \\ [module_attributes: []])

  def generate(nodes, state) when is_list(nodes) do
    NodeListGenerator.generate(nodes, state)
  end

  def generate(%Expression{ir: ir}, context) do
    ExpressionGenerator.generate(ir, context)
  end

  def generate(%ElementNode{attrs: attrs, children: children, tag: tag}, context) do
    ElementNodeGenerator.generate(tag, attrs, children, context)
  end

  def generate(%TextNode{text: text}, _) do
    TextNodeGenerator.generate(text)
  end
end
