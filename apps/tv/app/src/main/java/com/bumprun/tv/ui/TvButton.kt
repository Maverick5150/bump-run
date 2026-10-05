package com.bumprun.tv.ui

import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.interaction.collectIsFocusedAsState
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.TextUnit
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.bumprun.tv.ui.theme.BumpAccent2

/**
 * A Button with an unmistakable focus state for TV remote navigation --
 * scales up and gains a soft pulsing glow border when focused via D-pad.
 * Plain Material3 Button's default focus indication is too subtle to tell
 * which item is currently selected on a TV screen from across a room.
 */
@Composable
fun TvButton(
    text: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    height: Dp = 56.dp,
    fontSize: TextUnit = 18.sp,
    fontWeight: FontWeight = FontWeight.Bold,
    containerColor: Color = MaterialTheme.colorScheme.surfaceVariant,
    focusRequester: FocusRequester? = null,
    enabled: Boolean = true,
    icon: String? = null,
) {
    val interactionSource = remember { MutableInteractionSource() }
    val isFocused by interactionSource.collectIsFocusedAsState()
    val scale by animateFloatAsState(targetValue = if (isFocused) 1.07f else 1f, animationSpec = tween(150), label = "tvButtonScale")
    val glowAlpha by animateFloatAsState(targetValue = if (isFocused) 1f else 0f, animationSpec = tween(150), label = "tvButtonGlow")

    val pulseTransition = rememberInfiniteTransition(label = "tvButtonPulse")
    val pulse by pulseTransition.animateFloat(
        initialValue = 0.55f,
        targetValue = 1f,
        animationSpec = infiniteRepeatable(tween(700, easing = FastOutSlowInEasing), RepeatMode.Reverse),
        label = "pulse",
    )

    var buttonModifier = modifier
        .height(height)
        .graphicsLayer { scaleX = scale; scaleY = scale }
        .shadow(
            elevation = 12.dp * glowAlpha * pulse,
            shape = RoundedCornerShape(14.dp),
            ambientColor = BumpAccent2,
            spotColor = BumpAccent2,
        )
    if (focusRequester != null) {
        buttonModifier = buttonModifier.focusRequester(focusRequester)
    }

    Button(
        onClick = onClick,
        modifier = buttonModifier,
        enabled = enabled,
        shape = RoundedCornerShape(14.dp),
        interactionSource = interactionSource,
        colors = ButtonDefaults.buttonColors(containerColor = containerColor),
        border = if (isFocused) BorderStroke(3.dp, BumpAccent2.copy(alpha = 0.6f + 0.4f * pulse)) else null,
    ) {
        if (icon != null) {
            Text(icon, fontSize = fontSize)
            Spacer(Modifier.width(10.dp))
        }
        Text(text, fontSize = fontSize, fontWeight = fontWeight)
    }
}
