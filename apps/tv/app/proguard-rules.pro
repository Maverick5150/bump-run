# Socket.IO / engine.io use reflection-ish patterns around org.json; keep them intact.
-keep class io.socket.** { *; }
-keep class org.json.** { *; }
-dontwarn org.json.**
