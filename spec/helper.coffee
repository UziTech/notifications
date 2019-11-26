
###
A collection of methods for retrieving information about the user's system for
bug report purposes.
###

module.exports =

  generateException: ->
    try
      a / 0
    catch e
      errMsg = "#{e.toString()} in #{process.env.ATOM_HOME}/somewhere"
      errObj = {message: errMsg, url: '/dev/null', line: 2, column: 3, originalError: e}
      atom.emitter.emit.call(atom, 'will-throw-error', errObj)
      # atom.emitter.emit.call(atom, 'did-throw-error', errObj)
      window.onerror.call(window, errMsg, '/dev/null', 2, 3, e)

  # shortenerResponse
  # packageResponse
  # issuesResponse
  generateFakeFetchResponses: (options) ->
    spyOn(window, 'fetch') unless window.fetch.isSpy

    fetch.andCallFake (url) ->
      if url.indexOf('is.gd') > -1
        return textPromise options?.shortenerResponse ? 'http://is.gd/cats'

      if url.indexOf('atom.io/api/packages') > -1
        return jsonPromise(options?.packageResponse ? {
          repository: url: 'https://github.com/UziTech/notifications'
          releases: latest: '0.0.0'
        })

      if url.indexOf('atom.io/api/updates') > -1
        return(jsonPromise options?.atomResponse ? {name: atom.getVersion()})

      if options?.issuesErrorResponse?
        return Promise.reject(options?.issuesErrorResponse)

      jsonPromise(options?.issuesResponse ? {items: []})

jsonPromise = (object) -> Promise.resolve {ok: true, json: -> Promise.resolve object}
textPromise = (text) -> Promise.resolve {ok: true, text: -> Promise.resolve text}
