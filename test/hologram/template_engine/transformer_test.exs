defmodule Hologram.TemplateEngine.TransformerTest do
  use ExUnit.Case
  import Hologram.TemplateEngine.Parser, only: [parse!: 1]

  alias Hologram.TemplateEngine.AST.TagNode
  alias Hologram.TemplateEngine.AST.TextNode
  alias Hologram.TemplateEngine.Transformer

  describe "transform/1" do
    test "tag nodes without attrs" do
      result =
        parse!("<div><h1><span></span></h1></div>")
        |> Transformer.transform()

      expected =
        %TagNode{
          attrs: %{},
          children: [
            %TagNode{
              attrs: %{},
              children: [
                %TagNode{attrs: %{}, children: [], tag: "span"}
              ],
              tag: "h1"
            }
          ],
          tag: "div"
        }

      assert result == expected
    end

    test "tag nodes with attrs" do
      html = """
        <div class="class_1"><h1><span class="class_2" id="id_2"></span></h1></div>
      """

      result =
        parse!(html)
        |> Transformer.transform()

      expected =
        %TagNode{
          attrs: %{"class" => "class_1"},
          children: [
            %TagNode{
              attrs: %{},
              children: [
                %TagNode{
                  attrs: %{"class" => "class_2", "id" => "id_2"},
                  children: [],
                  tag: "span"
                }
              ],
              tag: "h1"
            }
          ],
          tag: "div"
        }

      assert result == expected
    end

    test "text nodes" do
      result =
        parse!("<div>test_text_1<h1><span>test_text_2</span></h1></div>")
        |> Transformer.transform()

      expected =
        %TagNode{
          attrs: %{},
          children: [
            %TextNode{text: "test_text_1"},
            %TagNode{
              attrs: %{},
              children: [
                %TagNode{
                  attrs: %{},
                  children: [%TextNode{text: "test_text_2"}],
                  tag: "span"
                }
              ],
              tag: "h1"
            }
          ],
          tag: "div"
        }

      assert result == expected
    end
  end
end
