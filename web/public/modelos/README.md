# Detección local de presencia

`blaze_face_short_range.tflite` es el modelo oficial BlazeFace de rango corto de
MediaPipe, versión float16/1. Se descarga desde:

https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite

Documentación y condiciones del proveedor:
https://ai.google.dev/edge/mediapipe/solutions/vision/face_detector

Los binarios WASM provienen de la dependencia fijada en package-lock.json y Vite
los empaqueta como recursos locales. La cámara no usa un CDN en tiempo de ejecución.
El modelo detecta posición de rostros, no identidad, emociones ni atributos personales.
