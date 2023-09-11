defmodule Hologram.Template.Renderer do
  alias Hologram.Commons.StringUtils
  alias Hologram.Component
  alias Hologram.Template.DOM

  # https://html.spec.whatwg.org/multipage/syntax.html#void-elements
  @void_elems ~w(area base br col embed hr img input link meta param source track wbr)

  @doc """
  Renders the given DOM node or DOM tree.

  ## Examples

      iex> node = {:component, Module3, [{"id", [text: "my_component"]}], []}
      iex> render(node, [])
      {
        "<div>state_a = 1, state_b = 2</div>",
        %{"my_component" => %Component.Client{state: %{a: 1, b: 2}}}
      }
  """
  @spec render(DOM.dom_node() | DOM.tree(), keyword(DOM.tree())) ::
          {String.t(), %{atom => Component.Client.t()}}
  def render(node_or_tree, slots)

  def render(nodes, slots) when is_list(nodes) do
    Enum.reduce(nodes, {"", %{}}, fn node, {acc_html, acc_clients} ->
      {html, clients} = render(node, slots)
      {acc_html <> html, Map.merge(acc_clients, clients)}
    end)
  end

  def render({:component, module, props_dom_tree, children}, slots) do
    children = expand_slots(children, slots)
    props = cast_props(props_dom_tree, module)

    if has_id_prop?(props) do
      render_stateful_component(module, props, children)
    else
      render_stateless_component(module, props, children)
    end
  end

  def render({:element, "slot", _attrs, []}, slots) do
    render(slots[:default], [])
  end

  def render({:element, tag, attrs, children}, slots) do
    attrs_html =
      if attrs != [] do
        attrs
        |> Enum.map_join(" ", fn {name, value_parts} ->
          {html, _clients} = render(value_parts, [])
          ~s(#{name}="#{html}")
        end)
        |> StringUtils.prepend(" ")
      else
        ""
      end

    {children_html, children_clients} = render(children, slots)

    html =
      if tag in @void_elems do
        "<#{tag}#{attrs_html} />"
      else
        "<#{tag}#{attrs_html}>#{children_html}</#{tag}>"
      end

    {html, children_clients}
  end

  def render({:expression, {value}}, _slots) do
    {to_string(value), %{}}
  end

  # TODO: Refactor once there is something akin to {...@var} syntax
  # (it would be possible to pass page state as layout props this way).
  def render({:page, page_module, params_dom_tree, []}, []) do
    params = cast_props(params_dom_tree, page_module)
    {page_client, _server} = init_component(page_module, params)
    vars = aggregate_vars(params, page_client.state)
    page_dom_tree = page_module.template().(vars)

    layout_module = page_module.__hologram_layout_module__()

    layout_props_dom_tree =
      page_module.__hologram_layout_props__()
      |> Enum.into(%{id: "layout"})
      |> aggregate_vars(page_client.state)
      |> Enum.map(fn {name, value} -> {to_string(name), [expression: {value}]} end)

    node = {:component, layout_module, layout_props_dom_tree, page_dom_tree}
    {html, clients_without_page} = render(node, [])
    clients = Map.put(clients_without_page, "page", page_client)

    {html, clients}
  end

  def render({:text, text}, _slots) do
    {text, %{}}
  end

  defp aggregate_vars(props, state) do
    Map.merge(props, state)
  end

  defp cast_props(props_dom_tree, module) do
    props_dom_tree
    |> filter_allowed_props(module)
    |> Stream.map(&evaluate_prop_value/1)
    |> Stream.map(&normalize_prop_name/1)
    |> Enum.into(%{})
  end

  defp evaluate_prop_value({name, [expression: {value}]}) do
    {name, value}
  end

  defp evaluate_prop_value({name, value_parts}) do
    {text, _clients} = render(value_parts, [])
    {name, text}
  end

  defp expand_slots(node_or_dom_tree, slots)

  defp expand_slots(nodes, slots) when is_list(nodes) do
    nodes
    |> Enum.map(&expand_slots(&1, slots))
    |> List.flatten()
  end

  defp expand_slots({:component, module, props, children}, slots) do
    {:component, module, props, expand_slots(children, slots)}
  end

  defp expand_slots({:element, "slot", _attrs, []}, slots) do
    slots[:default]
  end

  defp expand_slots({:element, tag, attrs, children}, slots) do
    {:element, tag, attrs, expand_slots(children, slots)}
  end

  defp expand_slots(node, _slots), do: node

  defp filter_allowed_props(props_dom_tree, module) do
    registered_prop_names =
      Enum.map(module.__props__(), fn {name, _type, _opts} -> to_string(name) end)

    allowed_props = ["id" | registered_prop_names]

    Enum.filter(props_dom_tree, fn {name, _value_parts} -> name in allowed_props end)
  end

  defp has_id_prop?(props) do
    Enum.any?(props, fn {name, _value} -> name == :id end)
  end

  defp init_component(module, props) do
    init_result = module.init(props, %Component.Client{}, %Component.Server{})

    case init_result do
      {client, server} ->
        {client, server}

      %Component.Client{} = client ->
        {client, %Component.Server{}}

      %Component.Server{} = server ->
        {%Component.Client{}, server}
    end
  end

  defp normalize_prop_name({name, value}) do
    {String.to_existing_atom(name), value}
  end

  defp render_stateful_component(module, props, children) do
    {client, _server} = init_component(module, props)
    vars = aggregate_vars(props, client.state)

    {html, children_clients} = render_template(module, vars, children)
    clients = Map.put(children_clients, vars.id, client)

    {html, clients}
  end

  defp render_stateless_component(module, props, children) do
    # We need to run the default init/3 to determine if it's actually a stateful component that is missing the `id` prop.
    {client, server} = init_component(module, props)

    if client != %Component.Client{} || server != %Component.Server{} do
      raise Hologram.Template.SyntaxError,
        message: "Stateful component #{module} is missing the 'id' property."
    end

    vars = aggregate_vars(props, %{})

    render_template(module, vars, children)
  end

  defp render_template(module, vars, children) do
    vars
    |> module.template().()
    |> render(default: children)
  end
end
