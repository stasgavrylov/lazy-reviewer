'use strict'

const $ = document.querySelector.bind(document)

document.addEventListener('input', function({ target }) {
  if (target.matches('.domain')) {
    updateDomain(target)
  }
  if (target.matches('.key')) {
    removeSuccess(target)
  }
})
document.addEventListener('click', function({ target }) {
  if (target.matches('.keysetter')) {
    const $container = target.closest('.credentials')
    const host = $container.querySelector('.domain').value
    const $key = $container.querySelector('.key')
    const { value } = $key

    if (!value) return

    chrome.storage.local.set(
      { [host]: { key: value, service: target.dataset.service } },
      function() { addSuccess($key) }
    )
    chrome.storage.local.get('hosts', function({ hosts }) {
      if (hosts.includes(host)) return
      chrome.storage.local.set({ 'hosts': [...hosts, host] })
    })
  }
})



const tokenUrls = {
  github: {
    default: 'https://github.com/settings/tokens/new',
    custom: host => `https://${host}/settings/tokens/new`,
  },
  gitlab: {
    default: 'https://gitlab.com/profile/personal_access_tokens',
    custom: host => `https://${host}/profile/personal_access_tokens`,
  },
}

function updateDomain(target) {
  const { value } = target
  const { service } = target.dataset
  const $tokenLink = $(`#goto-${service}`)
  const urls = tokenUrls[service]

  $tokenLink.href = value ? urls.custom(value) : urls.default
}

function addSuccess(target) {
  target.classList.add('success')
}

function removeSuccess(target) {
  target.classList.remove('success')
}
