# SoundCloud Player

Control Soundcloud from your toolbar, with ease.

One of my favourite sites at the moment is SoundCloud.com; I’m playing my ever growing stream all day long while coding, so I knew exactly what to build: sound player controls in Australis style!

I was in for a pleasant surprise. Not only were the APIs straightforward to use, but the Addon-SDK APIs were also pleasantly well-documented.

Time for a couple of screenshots of the end result:
* http://note.io/1gDTNQ0
* http://note.io/1gDTSTW
* http://note.io/1hQ2Q5L
* http://note.io/1gDTZyT
* http://note.io/1hQ2U5z

You can find the add-on on AMO at https://addons.mozilla.org/en-US/firefox/addon/soundcloud-player/

License: MPL.

Sources and build instructions of the binary components can be found at https://github.com/mstange/mediakeysappleremotesimfy/tree/895c6b9a86ab919feb4d4b93481e78db3aff8ae5

Features:
* Looks up the first open SoundCloud tab and starts playing the first song in it.
* Opens a new tab when it can’t find one
* Skip to next or previous song
* Uses the SoundCloud in-page event hub to track player status
* Localizable (standard SDK feature)
* Support for OSX media keys and Apple Remote - thanks to Markus Stange!
  * Check out his project at https://github.com/mstange/mediakeysappleremotesimfy
* Repo contains some tools that I built around it to make creating future add-ons easier:
  * CSS pre-processor, so you can write Mozilla-style CSS(tm): %define, %ifdef…else…endif
  * variable substitution
  * and more fun stuff.
  * Simple abstraction for writing wide-widget add-ons.
  * No docs. Yet. :-/

Cheers and have fun!

Mike.
