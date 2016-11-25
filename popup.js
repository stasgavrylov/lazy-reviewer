const $ = document.querySelector.bind(document)

const $domain = $('#gitlab-domain')
const $settings = $('#goto-profile')
const $key = $('#gitlab-key')
const $setKey = $('#set-gitlab-key')

$key.addEventListener('change', function(e) {
  this.classList.remove('success')
})

$domain.addEventListener('change', function(e) {
  $settings.setAttribute(
    'href',
    `https://${e.target.value || 'gitlab.com'}/profile/personal_access_tokens`
  )
})

$setKey.addEventListener('click', function(e) {
  const host = $domain.value || 'gitlab.com'
  chrome.storage.local.set({ [host]: $key.value }, function() {
    $key.classList.add('success')
  })
})