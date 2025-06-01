#!/usr/bin/env bash
# Bash completion script for Fuego CLI
# Install: source this file in your ~/.bashrc or ~/.bash_profile

_fuego_completion() {
    local cur prev opts
    COMPREPLY=()
    cur="${COMP_WORDS[COMP_CWORD]}"
    prev="${COMP_WORDS[COMP_CWORD-1]}"
    
    # Main commands and options
    local main_opts="auth logout whoami --backend --frontend --architect --auto --set-default --context --list --chain --update --stats --version --help -b -f -a -l -c -u -v -h"
    
    # Context options for --set-default
    local contexts="backend frontend architect"
    
    # Handle different cases
    case "${prev}" in
        auth)
            # Suggest API key prefix
            COMPREPLY=( $(compgen -W "gph_" -- ${cur}) )
            return 0
            ;;
        --set-default)
            COMPREPLY=( $(compgen -W "${contexts}" -- ${cur}) )
            return 0
            ;;
        --chain|-c)
            # Common chain queries
            local chain_queries="'implement real-time notifications' 'add authentication' 'create dashboard' 'optimize performance'"
            COMPREPLY=( $(compgen -W "${chain_queries}" -- ${cur}) )
            return 0
            ;;
        fuego)
            # If first argument after fuego
            COMPREPLY=( $(compgen -W "${main_opts}" -- ${cur}) )
            return 0
            ;;
    esac
    
    # Handle options that start with dash
    if [[ ${cur} == -* ]] ; then
        COMPREPLY=( $(compgen -W "${main_opts}" -- ${cur}) )
        return 0
    fi
    
    # Default to file completion
    COMPREPLY=( $(compgen -f -- ${cur}) )
}

# Register the completion function
complete -F _fuego_completion fuego

# Also support the 'fue' shorthand
complete -F _fuego_completion fue