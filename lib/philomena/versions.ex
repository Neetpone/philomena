defmodule Philomena.Versions do
  @moduledoc """
  The Versions context.
  """

  import Ecto.Query, warn: false
  alias Philomena.Repo

  alias Philomena.Versions.Version
  alias Philomena.Users.User

  def load_data_and_associations(versions, parent) do
    user_ids =
      versions
      |> Enum.map(& &1.whodunnit)
      |> Enum.reject(&is_nil/1)

    users =
      User
      |> where([u], u.id in ^user_ids)
      |> preload(awards: :badge)
      |> Repo.all()
      |> Map.new(&{to_string(&1.id), &1})

    {versions, _last_body} =
      versions
      |> Enum.reverse()
      |> Enum.map_reduce(nil, fn version, previous_body ->
        yaml = YamlElixir.read_from_string!(version.object || "")
        body = yaml["body"] || ""
        edit_reason = yaml["edit_reason"]

        v =
          %{
            version |
            parent: parent,
            user: users[version.whodunnit],
            body: body,
            edit_reason: edit_reason,
            difference: difference(previous_body, body)
          }

        {v, body}
      end)

    Enum.reverse(versions)
  end

  defp difference(nil, next), do: [eq: next]
  defp difference(previous, next), do: String.myers_difference(previous, next)

  @doc """
  Creates a version.

  ## Examples

      iex> create_version(%{field: value})
      {:ok, %Version{}}

      iex> create_version(%{field: bad_value})
      {:error, %Ecto.Changeset{}}

  """
  def create_version(attrs \\ %{}) do
    %Version{}
    |> Version.changeset(attrs)
    |> Repo.insert()
  end
end
