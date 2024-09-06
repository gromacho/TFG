# Template for python packages

Template for new python packages created by RTI.

## Package manager

As a package manager we recommend [Poetry]. [Poetry] is a tool that helps you
build, test and upload Python packages. It also manages the package dependencies
and checks for version conflicts between them.

To install the package and all its dependencies, run:

```bash
pip install poetry==1.2.1
poetry install
```

### Uploading the package

The repository provides a Jenkinsfile that serve two purposes:

- Run CI in pull-requests and main branches
- Publish the package when building from a tag (you only need to push a tag to
  publish a version).

## Package configuration

This sample package relies on a [pyproject.toml]. This file contains all the
necessary configuration for [Poetry] including:

- Build system dependencies
- Package metadata
- Versioning configuration
- Dependencies
- Extra libraries configurations

## Testing and linting

For testing and linting we use [tox], which is configured on [pyproject.toml].
[tox] executes all the needed commands in a separated virtual environment for
each Python version indicated. To do so, run the following:

```bash
poetry run tox
```

[Poetry]: https://python-poetry.org/docs/
[pyproject.toml]: ./pyproject.toml
[tox]: https://tox.wiki/en/latest/
