defmodule Hologram.Template.DOMTest do
  use Hologram.Test.BasicCase, async: true
  import Hologram.Template.DOM

  describe "build_ast/1, text node" do
    test "without double quotes" do
      assert build_ast([{:text, "abc"}]) == [{:text, "abc"}]
    end

    test "with double quotes" do
      assert build_ast([{:text, "aaa\"bbb\"ccc"}]) == [text: "aaa\"bbb\"ccc"]
    end
  end

  describe "build_ast/1, element node & component node" do
    nodes = [
      {:element, "attribute", "div", "div"},
      {:component, "property", "Aaa.Bbb",
       quote do
         {:alias!, [line: 1], [{:__aliases__, [line: 1], [:Aaa, :Bbb]}]}
       end}
    ]

    Enum.each(nodes, fn {tag_type, attr_or_prop, tag_name, expected_tag_name_ast} ->
      test "#{tag_type} node without #{attr_or_prop}(s) or children" do
        tags = [{:start_tag, {unquote(tag_name), []}}, {:end_tag, unquote(tag_name)}]

        assert build_ast(tags) == [
                 {:{}, [line: 1], [unquote(tag_type), unquote(expected_tag_name_ast), [], []]}
               ]
      end

      test "#{tag_type} node with single #{attr_or_prop}" do
        tags = [
          {:start_tag, {unquote(tag_name), [{"my_key", [text: "my_value"]}]}},
          {:end_tag, unquote(tag_name)}
        ]

        assert build_ast(tags) ==
                 [
                   {:{}, [line: 1],
                    [
                      unquote(tag_type),
                      unquote(expected_tag_name_ast),
                      [{"my_key", [text: "my_value"]}],
                      []
                    ]}
                 ]
      end

      test "#{tag_type} node, with multiple #{attr_or_prop}(s)" do
        tags = [
          {:start_tag,
           {unquote(tag_name),
            [{"my_key_1", [text: "my_value_1"]}, {"my_key_2", [text: "my_value_2"]}]}},
          {:end_tag, unquote(tag_name)}
        ]

        assert build_ast(tags) == [
                 {:{}, [line: 1],
                  [
                    unquote(tag_type),
                    unquote(expected_tag_name_ast),
                    [{"my_key_1", [text: "my_value_1"]}, {"my_key_2", [text: "my_value_2"]}],
                    []
                  ]}
               ]
      end

      test "#{tag_type} node #{attr_or_prop} with multiple value parts" do
        tags = [
          {:start_tag,
           {unquote(tag_name), [{"my_key", [text: "my_value_1", text: "my_value_2"]}]}},
          {:end_tag, unquote(tag_name)}
        ]

        assert build_ast(tags) == [
                 {:{}, [line: 1],
                  [
                    unquote(tag_type),
                    unquote(expected_tag_name_ast),
                    [{"my_key", [text: "my_value_1", text: "my_value_2"]}],
                    []
                  ]}
               ]
      end

      test "#{tag_type} node with text child" do
        tags = [
          {:start_tag, {unquote(tag_name), []}},
          {:text, "abc"},
          {:end_tag, unquote(tag_name)}
        ]

        assert build_ast(tags) == [
                 {:{}, [line: 1],
                  [unquote(tag_type), unquote(expected_tag_name_ast), [], [{:text, "abc"}]]}
               ]
      end

      test "#{tag_type} node with element child" do
        tags = [
          {:start_tag, {unquote(tag_name), []}},
          {:start_tag, {"span", []}},
          {:end_tag, "span"},
          {:end_tag, unquote(tag_name)}
        ]

        assert build_ast(tags) == [
                 {:{}, [line: 1],
                  [
                    unquote(tag_type),
                    unquote(expected_tag_name_ast),
                    [],
                    [{:{}, [line: 1], [:element, "span", [], []]}]
                  ]}
               ]
      end

      test "#{tag_type} node with component child" do
        tags = [
          {:start_tag, {unquote(tag_name), []}},
          {:start_tag, {"Xxx.Yyy", []}},
          {:end_tag, "Xxx.Yyy"},
          {:end_tag, unquote(tag_name)}
        ]

        assert build_ast(tags) == [
                 {:{}, [line: 1],
                  [
                    unquote(tag_type),
                    unquote(expected_tag_name_ast),
                    [],
                    [
                      {:{}, [line: 1],
                       [
                         :component,
                         {:alias!, [line: 1], [{:__aliases__, [line: 1], [:Xxx, :Yyy]}]},
                         [],
                         []
                       ]}
                    ]
                  ]}
               ]
      end

      test "#{tag_type} node with multiple children" do
        tags = [
          {:start_tag, {unquote(tag_name), []}},
          {:start_tag, {"span", []}},
          {:end_tag, "span"},
          {:text, "abc"},
          {:end_tag, unquote(tag_name)}
        ]

        assert build_ast(tags) == [
                 {:{}, [line: 1],
                  [
                    unquote(tag_type),
                    unquote(expected_tag_name_ast),
                    [],
                    [{:{}, [line: 1], [:element, "span", [], []]}, {:text, "abc"}]
                  ]}
               ]
      end

      test "self-closing #{tag_type} node, not nested, without siblings" do
        tags = [
          {:self_closing_tag,
           {unquote(tag_name),
            [{"my_key_1", [text: "my_value_1"]}, {"my_key_2", [text: "my_value_2"]}]}}
        ]

        assert build_ast(tags) == [
                 {:{}, [line: 1],
                  [
                    unquote(tag_type),
                    unquote(expected_tag_name_ast),
                    [{"my_key_1", [text: "my_value_1"]}, {"my_key_2", [text: "my_value_2"]}],
                    []
                  ]}
               ]
      end

      test "self-closing #{tag_type} node, not nested, with siblings" do
        tags = [
          {:text, "abc"},
          {:self_closing_tag,
           {unquote(tag_name),
            [{"my_key_1", [text: "my_value_1"]}, {"my_key_2", [text: "my_value_2"]}]}},
          {:text, "xyz"}
        ]

        assert build_ast(tags) == [
                 {:text, "abc"},
                 {:{}, [line: 1],
                  [
                    unquote(tag_type),
                    unquote(expected_tag_name_ast),
                    [{"my_key_1", [text: "my_value_1"]}, {"my_key_2", [text: "my_value_2"]}],
                    []
                  ]},
                 {:text, "xyz"}
               ]
      end

      test "self-closing #{tag_type} node, nested, without siblings" do
        tags = [
          {:start_tag, {"div", []}},
          {:self_closing_tag,
           {unquote(tag_name),
            [{"my_key_1", [text: "my_value_1"]}, {"my_key_2", [text: "my_value_2"]}]}},
          {:end_tag, "div"}
        ]

        assert build_ast(tags) == [
                 {:{}, [line: 1],
                  [
                    :element,
                    "div",
                    [],
                    [
                      {:{}, [line: 1],
                       [
                         unquote(tag_type),
                         unquote(expected_tag_name_ast),
                         [
                           {"my_key_1", [text: "my_value_1"]},
                           {"my_key_2", [text: "my_value_2"]}
                         ],
                         []
                       ]}
                    ]
                  ]}
               ]
      end

      test "self-closing #{tag_type} node, nested, with siblings" do
        tags = [
          {:start_tag, {"div", []}},
          {:text, "abc"},
          {:self_closing_tag,
           {unquote(tag_name),
            [{"my_key_1", [text: "my_value_1"]}, {"my_key_2", [text: "my_value_2"]}]}},
          {:text, "xyz"},
          {:end_tag, "div"}
        ]

        assert build_ast(tags) == [
                 {:{}, [line: 1],
                  [
                    :element,
                    "div",
                    [],
                    [
                      {:text, "abc"},
                      {:{}, [line: 1],
                       [
                         unquote(tag_type),
                         unquote(expected_tag_name_ast),
                         [
                           {"my_key_1", [text: "my_value_1"]},
                           {"my_key_2", [text: "my_value_2"]}
                         ],
                         []
                       ]},
                      {:text, "xyz"}
                    ]
                  ]}
               ]
      end
    end)
  end

  describe "build_ast/1, expression node" do
    test "in text" do
      tags = [{:text, "abc"}, {:expression, "{1 + 2}"}, {:text, "xyz"}]

      assert build_ast(tags) == [
               text: "abc",
               expression: {:{}, [line: 1], [{:+, [line: 1], [1, 2]}]},
               text: "xyz"
             ]
    end

    nodes = [
      {:element, "attribute", "div", "div"},
      {:component, "property", "Aaa.Bbb",
       quote do
         {:alias!, [line: 1], [{:__aliases__, [line: 1], [:Aaa, :Bbb]}]}
       end}
    ]

    Enum.each(nodes, fn {tag_type, attr_or_prop, tag_name, expected_tag_name_ast} ->
      test "in #{tag_type} #{attr_or_prop} value, with one part only" do
        tags = [
          {:start_tag, {unquote(tag_name), [{"my_key", [expression: "{1 + 2}"]}]}},
          {:end_tag, unquote(tag_name)}
        ]

        assert build_ast(tags) == [
                 {:{}, [line: 1],
                  [
                    unquote(tag_type),
                    unquote(expected_tag_name_ast),
                    [{"my_key", [expression: {:{}, [line: 1], [{:+, [line: 1], [1, 2]}]}]}],
                    []
                  ]}
               ]
      end

      test "in #{tag_type} #{attr_or_prop} value, after text part" do
        tags = [
          {:start_tag,
           {unquote(tag_name), [{"my_key", [text: "my_value", expression: "{1 + 2}"]}]}},
          {:end_tag, unquote(tag_name)}
        ]

        assert build_ast(tags) == [
                 {:{}, [line: 1],
                  [
                    unquote(tag_type),
                    unquote(expected_tag_name_ast),
                    [
                      {"my_key",
                       [
                         text: "my_value",
                         expression: {:{}, [line: 1], [{:+, [line: 1], [1, 2]}]}
                       ]}
                    ],
                    []
                  ]}
               ]
      end

      test "in #{tag_type} #{attr_or_prop} value, before text part" do
        tags = [
          {:start_tag,
           {unquote(tag_name), [{"my_key", [expression: "{1 + 2}", text: "my_value"]}]}},
          {:end_tag, unquote(tag_name)}
        ]

        assert build_ast(tags) == [
                 {:{}, [line: 1],
                  [
                    unquote(tag_type),
                    unquote(expected_tag_name_ast),
                    [
                      {"my_key",
                       [
                         expression: {:{}, [line: 1], [{:+, [line: 1], [1, 2]}]},
                         text: "my_value"
                       ]}
                    ],
                    []
                  ]}
               ]
      end

      test "in #{tag_type} #{attr_or_prop} value, after another expression part" do
        tags = [
          {:start_tag,
           {unquote(tag_name), [{"my_key", [expression: "{1 + 2}", expression: "{@my_var * 9}"]}]}},
          {:end_tag, unquote(tag_name)}
        ]

        assert build_ast(tags) == [
                 {:{}, [line: 1],
                  [
                    unquote(tag_type),
                    unquote(expected_tag_name_ast),
                    [
                      {"my_key",
                       [
                         expression: {:{}, [line: 1], [{:+, [line: 1], [1, 2]}]},
                         expression:
                           {:{}, [line: 1],
                            [
                              {:*, [line: 1],
                               [
                                 {{:., [line: 1], [{:vars, [line: 1], nil}, :my_var]},
                                  [no_parens: true, line: 1], []},
                                 9
                               ]}
                            ]}
                       ]}
                    ],
                    []
                  ]}
               ]
      end
    end)
  end

  describe "build_ast/1, for block" do
    test "with one child" do
      tags = [{:block_start, {"for", "{ item <- @items}"}}, {:text, "abc"}, {:block_end, "for"}]

      assert build_ast(tags) == [
               {:for, [line: 1],
                [
                  {:<-, [line: 1],
                   [
                     {:item, [line: 1], nil},
                     {{:., [line: 1], [{:vars, [line: 1], nil}, :items]},
                      [no_parens: true, line: 1], []}
                   ]},
                  [do: {:__block__, [], [[text: "abc"]]}]
                ]}
             ]
    end

    test "with multiple children" do
      tags = [
        {:block_start, {"for", "{ item <- @items}"}},
        {:text, "abc"},
        {:start_tag, {"div", []}},
        {:end_tag, "div"},
        {:block_end, "for"}
      ]

      assert build_ast(tags) == [
               {:for, [line: 1],
                [
                  {:<-, [line: 1],
                   [
                     {:item, [line: 1], nil},
                     {{:., [line: 1], [{:vars, [line: 1], nil}, :items]},
                      [no_parens: true, line: 1], []}
                   ]},
                  [
                    do:
                      {:__block__, [],
                       [[{:text, "abc"}, {:{}, [line: 1], [:element, "div", [], []]}]]}
                  ]
                ]}
             ]
    end
  end

  describe "build_ast/1, if block" do
    test "with one child" do
      tags = [{:block_start, {"if", "{ @xyz == 123}"}}, {:text, "abc"}, {:block_end, "if"}]

      assert build_ast(tags) == [
               {:if, [line: 1],
                [
                  {:==, [line: 1],
                   [
                     {{:., [line: 1], [{:vars, [line: 1], nil}, :xyz]},
                      [no_parens: true, line: 1], []},
                     123
                   ]},
                  [do: [text: "abc"]]
                ]}
             ]
    end

    test "with multiple children" do
      tags = [
        {:block_start, {"if", "{ @xyz == 123}"}},
        {:text, "abc"},
        {:start_tag, {"div", []}},
        {:end_tag, "div"},
        {:block_end, "if"}
      ]

      assert build_ast(tags) == [
               {:if, [line: 1],
                [
                  {:==, [line: 1],
                   [
                     {{:., [line: 1], [{:vars, [line: 1], nil}, :xyz]},
                      [no_parens: true, line: 1], []},
                     123
                   ]},
                  [
                    do: [{:text, "abc"}, {:{}, [line: 1], [:element, "div", [], []]}]
                  ]
                ]}
             ]
    end

    test "with else subblock having single child" do
      tags = [
        {:block_start, {"if", "{ @xyz == 123}"}},
        {:text, "aaa"},
        {:block_start, "else"},
        {:text, "bbb"},
        {:block_end, "if"}
      ]

      assert build_ast(tags) == [
               {:if, [line: 1],
                [
                  {:==, [line: 1],
                   [
                     {{:., [line: 1], [{:vars, [line: 1], nil}, :xyz]},
                      [no_parens: true, line: 1], []},
                     123
                   ]},
                  [do: [{:text, "aaa"}], else: [{:text, "bbb"}]]
                ]}
             ]
    end

    test "with else subblock having multiple children" do
      tags = [
        {:block_start, {"if", "{ @xyz == 123}"}},
        {:text, "aaa"},
        {:block_start, "else"},
        {:text, "bbb"},
        {:start_tag, {"div", []}},
        {:end_tag, "div"},
        {:block_end, "if"}
      ]

      assert build_ast(tags) == [
               {:if, [line: 1],
                [
                  {:==, [line: 1],
                   [
                     {{:., [line: 1], [{:vars, [line: 1], nil}, :xyz]},
                      [no_parens: true, line: 1], []},
                     123
                   ]},
                  [
                    do: [{:text, "aaa"}],
                    else: [{:text, "bbb"}, {:{}, [line: 1], [:element, "div", [], []]}]
                  ]
                ]}
             ]
    end

    test "nested in element node, as the only child" do
      # <div>{%if @aaa == 123}bbb{/if}</div>
      tags = [
        start_tag: {"div", []},
        block_start: {"if", "{ @aaa == 123}"},
        text: "bbb",
        block_end: "if",
        end_tag: "div"
      ]

      assert build_ast(tags) == [
               {:{}, [line: 1],
                [
                  :element,
                  "div",
                  [],
                  [
                    {:if, [line: 1],
                     [
                       {:==, [line: 1],
                        [
                          {{:., [line: 1], [{:vars, [line: 1], nil}, :aaa]},
                           [no_parens: true, line: 1], []},
                          123
                        ]},
                       [do: [text: "bbb"]]
                     ]}
                  ]
                ]}
             ]
    end

    test "nested in component node, as the only child" do
      # <MyComponent>{%if @aaa == 123}bbb{/if}</MyComponent>
      tags = [
        start_tag: {"MyComponent", []},
        block_start: {"if", "{ @aaa == 123}"},
        text: "bbb",
        block_end: "if",
        end_tag: "MyComponent"
      ]

      assert build_ast(tags) == [
               {:{}, [line: 1],
                [
                  :component,
                  {:alias!, [line: 1], [{:__aliases__, [line: 1], [:MyComponent]}]},
                  [],
                  [
                    {:if, [line: 1],
                     [
                       {:==, [line: 1],
                        [
                          {{:., [line: 1], [{:vars, [line: 1], nil}, :aaa]},
                           [no_parens: true, line: 1], []},
                          123
                        ]},
                       [do: [text: "bbb"]]
                     ]}
                  ]
                ]}
             ]
    end

    test "nested in element node, as the first child of many" do
      # <div>{%if @aaa == 123}bbb{/if}ccc</div>
      tags = [
        start_tag: {"div", []},
        block_start: {"if", "{ @aaa == 123}"},
        text: "bbb",
        block_end: "if",
        text: "ccc",
        end_tag: "div"
      ]

      assert build_ast(tags) == [
               {:{}, [line: 1],
                [
                  :element,
                  "div",
                  [],
                  [
                    {:if, [line: 1],
                     [
                       {:==, [line: 1],
                        [
                          {{:., [line: 1], [{:vars, [line: 1], nil}, :aaa]},
                           [no_parens: true, line: 1], []},
                          123
                        ]},
                       [do: [text: "bbb"]]
                     ]},
                    {:text, "ccc"}
                  ]
                ]}
             ]
    end

    test "nested in component node, as the first child of many" do
      # <MyComponent>{%if @aaa == 123}bbb{/if}ccc</MyComponent>
      tags = [
        start_tag: {"MyComponent", []},
        block_start: {"if", "{ @aaa == 123}"},
        text: "bbb",
        block_end: "if",
        text: "ccc",
        end_tag: "MyComponent"
      ]

      assert build_ast(tags) == [
               {:{}, [line: 1],
                [
                  :component,
                  {:alias!, [line: 1], [{:__aliases__, [line: 1], [:MyComponent]}]},
                  [],
                  [
                    {:if, [line: 1],
                     [
                       {:==, [line: 1],
                        [
                          {{:., [line: 1], [{:vars, [line: 1], nil}, :aaa]},
                           [no_parens: true, line: 1], []},
                          123
                        ]},
                       [do: [text: "bbb"]]
                     ]},
                    {:text, "ccc"}
                  ]
                ]}
             ]
    end

    test "nested in element node, as the last child of many" do
      # <div>ccc{%if @aaa == 123}bbb{/if}</div>
      tags = [
        start_tag: {"div", []},
        text: "ccc",
        block_start: {"if", "{ @aaa == 123}"},
        text: "bbb",
        block_end: "if",
        end_tag: "div"
      ]

      assert build_ast(tags) == [
               {:{}, [line: 1],
                [
                  :element,
                  "div",
                  [],
                  [
                    {:text, "ccc"},
                    {:if, [line: 1],
                     [
                       {:==, [line: 1],
                        [
                          {{:., [line: 1], [{:vars, [line: 1], nil}, :aaa]},
                           [no_parens: true, line: 1], []},
                          123
                        ]},
                       [do: [text: "bbb"]]
                     ]}
                  ]
                ]}
             ]
    end

    test "nested in component node, as the last child of many" do
      # <MyComponent>ccc{%if @aaa == 123}bbb{/if}</MyComponent>
      tags = [
        start_tag: {"MyComponent", []},
        text: "ccc",
        block_start: {"if", "{ @aaa == 123}"},
        text: "bbb",
        block_end: "if",
        end_tag: "MyComponent"
      ]

      assert build_ast(tags) == [
               {:{}, [line: 1],
                [
                  :component,
                  {:alias!, [line: 1], [{:__aliases__, [line: 1], [:MyComponent]}]},
                  [],
                  [
                    {:text, "ccc"},
                    {:if, [line: 1],
                     [
                       {:==, [line: 1],
                        [
                          {{:., [line: 1], [{:vars, [line: 1], nil}, :aaa]},
                           [no_parens: true, line: 1], []},
                          123
                        ]},
                       [do: [text: "bbb"]]
                     ]}
                  ]
                ]}
             ]
    end
  end

  describe "build_ast/1, substitute module attributes" do
    test "non-nested list" do
      tags = [{:expression, "{[1, @a, 2, @b]}"}]

      assert build_ast(tags) == [
               {
                 :expression,
                 {:{}, [line: 1],
                  [
                    [
                      1,
                      {{:., [line: 1], [{:vars, [line: 1], nil}, :a]}, [no_parens: true, line: 1],
                       []},
                      2,
                      {{:., [line: 1], [{:vars, [line: 1], nil}, :b]}, [no_parens: true, line: 1],
                       []}
                    ]
                  ]}
               }
             ]
    end

    test "nested list" do
      tags = [{:expression, "{[1, @a, [2, @b, 3, @c]]}"}]

      assert build_ast(tags) == [
               {
                 :expression,
                 {:{}, [line: 1],
                  [
                    [
                      1,
                      {{:., [line: 1], [{:vars, [line: 1], nil}, :a]}, [no_parens: true, line: 1],
                       []},
                      [
                        2,
                        {{:., [line: 1], [{:vars, [line: 1], nil}, :b]},
                         [no_parens: true, line: 1], []},
                        3,
                        {{:., [line: 1], [{:vars, [line: 1], nil}, :c]},
                         [no_parens: true, line: 1], []}
                      ]
                    ]
                  ]}
               }
             ]
    end

    test "non-nested 2-element tuple" do
      tags = [{:expression, "{{@a, @b}}"}]

      assert build_ast(tags) == [
               {:expression,
                {:{}, [line: 1],
                 [
                   {{{:., [line: 1], [{:vars, [line: 1], nil}, :a]}, [no_parens: true, line: 1],
                     []},
                    {{:., [line: 1], [{:vars, [line: 1], nil}, :b]}, [no_parens: true, line: 1],
                     []}}
                 ]}}
             ]
    end

    test "nested 2-element tuple" do
      tags = [{:expression, "{{1, {@a, @b}}}"}]

      assert build_ast(tags) == [
               {:expression,
                {:{}, [line: 1],
                 [
                   {1,
                    {{{:., [line: 1], [{:vars, [line: 1], nil}, :a]}, [no_parens: true, line: 1],
                      []},
                     {{:., [line: 1], [{:vars, [line: 1], nil}, :b]}, [no_parens: true, line: 1],
                      []}}}
                 ]}}
             ]
    end

    test "non-nested 4-element tuple" do
      tags = [{:expression, "{{1, @a, 2, @b}}"}]

      assert build_ast(tags) == [
               {:expression,
                {:{}, [line: 1],
                 [
                   {:{}, [line: 1],
                    [
                      1,
                      {{:., [line: 1], [{:vars, [line: 1], nil}, :a]}, [no_parens: true, line: 1],
                       []},
                      2,
                      {{:., [line: 1], [{:vars, [line: 1], nil}, :b]}, [no_parens: true, line: 1],
                       []}
                    ]}
                 ]}}
             ]
    end

    test "nested 4-element tuple" do
      tags = [{:expression, "{{1, @a, {2, @b, 3, @c}, 4}}"}]

      assert build_ast(tags) == [
               {:expression,
                {:{}, [line: 1],
                 [
                   {:{}, [line: 1],
                    [
                      1,
                      {{:., [line: 1], [{:vars, [line: 1], nil}, :a]}, [no_parens: true, line: 1],
                       []},
                      {:{}, [line: 1],
                       [
                         2,
                         {{:., [line: 1], [{:vars, [line: 1], nil}, :b]},
                          [no_parens: true, line: 1], []},
                         3,
                         {{:., [line: 1], [{:vars, [line: 1], nil}, :c]},
                          [no_parens: true, line: 1], []}
                       ]},
                      4
                    ]}
                 ]}}
             ]
    end
  end

  test "build_ast/1, nested AST" do
    tags = [{:expression, "{(fn x -> [x | @acc] end).(@value)}"}]

    assert build_ast(tags) == [
             {
               :expression,
               {:{}, [line: 1],
                [
                  {{:., [line: 1],
                    [
                      {:fn, [line: 1],
                       [
                         {:->, [line: 1],
                          [
                            [{:x, [line: 1], nil}],
                            {:__block__, [],
                             [
                               [
                                 {:|, [line: 1],
                                  [
                                    {:x, [line: 1], nil},
                                    {{:., [line: 1], [{:vars, [line: 1], nil}, :acc]},
                                     [no_parens: true, line: 1], []}
                                  ]}
                               ]
                             ]}
                          ]}
                       ]}
                    ]}, [line: 1],
                   [
                     {{:., [line: 1], [{:vars, [line: 1], nil}, :value]},
                      [no_parens: true, line: 1], []}
                   ]}
                ]}
             }
           ]
  end
end
