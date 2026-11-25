GIT_SHA := $(shell git rev-parse --short HEAD)
SERVICES := frontend api-gateway login register user complaint hostel category staff priority assignment status notification feedback announcement report
COMPOSE := docker compose

.PHONY: build build-jobs

build:
	@test -n "$(GIT_SHA)" || { echo "A Git commit is required to tag the images"; exit 1; }
	IMAGE_TAG=$(GIT_SHA) $(COMPOSE) build $(SERVICES)

build-jobs:
	@test -n "$(GIT_SHA)" || { echo "A Git commit is required to tag the image"; exit 1; }
	IMAGE_TAG=$(GIT_SHA) $(COMPOSE) build escalate
