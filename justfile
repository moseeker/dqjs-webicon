# This is this
all:
  just --list
# Push to all remotes
push:
    #!/usr/bin/env bash
    for remote in $(git remote); do
        echo "Pushing to $remote..."
        git push "$remote"
    done
