# dockerfile Specification

## Purpose
Enable the app to be built and run as a Docker container, matching the
capability accepted into upstream from the Manchester Centre for Genomic Medicine.

## Requirements

### Requirement: Dockerfile produces a runnable container
A `Dockerfile` SHALL exist at the repository root that builds the production
webpack bundle and serves it on port 9000. The base image SHALL use Node 24.

#### Scenario: Container starts and serves the app
- **WHEN** `docker build -t open-pedigree . && docker run -p 9000:9000 open-pedigree` is run
- **THEN** the pedigree editor is accessible at `http://localhost:9000/`

#### Scenario: Build uses production mode
- **WHEN** the Docker image is built
- **THEN** `npm run build` (production webpack) is used, not the dev server

### Requirement: README documents Docker usage
The README SHALL include a Docker usage section with the build and run commands.

#### Scenario: Docker section in README
- **WHEN** a user reads README.md
- **THEN** they can find copy-pasteable `docker build` and `docker run` commands
