package com.bumprun.tv.ui

import android.graphics.Bitmap
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.foundation.Image
import com.google.zxing.BarcodeFormat
import com.google.zxing.qrcode.QRCodeWriter

/** Pure-Java QR generation (ZXing) -- no network calls, no Google Play Services. */
fun generateQrBitmap(content: String, sizePx: Int = 512): Bitmap {
    val writer = QRCodeWriter()
    val matrix = writer.encode(content, BarcodeFormat.QR_CODE, sizePx, sizePx)
    val bitmap = Bitmap.createBitmap(sizePx, sizePx, Bitmap.Config.RGB_565)
    for (x in 0 until sizePx) {
        for (y in 0 until sizePx) {
            bitmap.setPixel(x, y, if (matrix[x, y]) 0xFF000000.toInt() else 0xFFFFFFFF.toInt())
        }
    }
    return bitmap
}

@Composable
fun QrCodeImage(content: String, modifier: Modifier = Modifier, sizePx: Int = 512) {
    val bitmap = remember(content) { generateQrBitmap(content, sizePx) }
    Image(bitmap = bitmap.asImageBitmap(), contentDescription = "Scan to join", modifier = modifier)
}
