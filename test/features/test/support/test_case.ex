defmodule HologramFeatureTests.TestCase do
  use ExUnit.CaseTemplate
  alias Wallaby.Feature.Utils

  # Based on Wallaby.Feature.__using__/1
  using do
    quote do
      ExUnit.Case.register_attribute(__MODULE__, :sessions)

      # Kernel.tap/2 was introduced in 1.12 and conflicts with Browser.tap/2
      import Kernel, except: [tap: 2]

      import HologramFeatureTestsWeb.Test.Helpers
      import Wallaby.Browser, except: [visit: 2]
      import Wallaby.Feature
      import Wallaby.Query

      setup context do
        metadata = Utils.maybe_checkout_repos(context[:async])

        start_session_opts =
          Utils.put_create_session_fn(
            [metadata: metadata],
            context[:create_session_fn]
          )

        context
        |> get_in([:registered, :sessions])
        |> Utils.sessions_iterable()
        |> Enum.map(fn
          opts when is_list(opts) ->
            Utils.start_session(opts, start_session_opts)

          i when is_number(i) ->
            Utils.start_session([], start_session_opts)
        end)
        |> Utils.build_setup_return()
      end
    end
  end
end
