module.exports =
class StatusBarManager
  count: 0

  constructor: (statusBar, @duplicateTimeDelay) ->
    @onClick = @onClick.bind(this)
    @onAnimationEnd = @onAnimationEnd.bind(this)
    @render()
    @tile = statusBar.addRightTile(
      item: @element
      priority: 10
    )

  render: ->
    @number = document.createElement('div')
    @number.classList.add('notifications-count-number')
    @number.textContent = @count
    @number.addEventListener 'animationend', @onAnimationEnd

    @element = document.createElement('a')
    @element.classList.add('notifications-count', 'inline-block')
    @tooltip = atom.tooltips.add(@element, title: '0 notifications')
    span = document.createElement('span')
    span.classList.add('notifications-count-badge')
    span.appendChild(@number)
    @element.appendChild(span)
    @element.addEventListener 'click', @onClick


    lastNotification = null
    for notification in atom.notifications.getNotifications()
      if lastNotification?
        # do not show duplicates unless some amount of time has passed
        timeSpan = notification.getTimestamp() - lastNotification.getTimestamp()
        unless timeSpan < @duplicateTimeDelay and notification.isEqual(lastNotification)
          @addNotification(notification)
      else
        @addNotification(notification)

      lastNotification = notification

  onClick: -> atom.commands.dispatch(@element, 'notifications-plus:toggle-log')

  onAnimationEnd: (e) -> @number.classList.remove('new-notification') if e.animationName is 'new-notification'

  destroy: ->
    @number.removeEventListener 'animationend', @onAnimationEnd
    @element.removeEventListener 'click', @onClick
    @tile.destroy()
    @tile = null
    @tooltip.dispose()
    @tooltip = null

  addNotification: (notification) ->
    @count++
    s = if @count is 1 then "" else "s"
    @tooltip.dispose()
    @tooltip = atom.tooltips.add(@element, title: "#{@count} notification#{s}")
    @element.setAttribute('last-type', notification.getType())
    @number.textContent = @count
    @number.classList.add('new-notification')

  clear: ->
    @count = 0
    @number.textContent = @count
    @element.removeAttribute 'last-type'
    @tooltip.dispose()
    @tooltip = atom.tooltips.add(@element, title: "0 notifications")
