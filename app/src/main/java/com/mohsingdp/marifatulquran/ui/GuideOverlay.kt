package com.mohsingdp.marifatulquran.ui

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Rect
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.BlendMode
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.CompositingStrategy
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.boundsInRoot
import androidx.compose.ui.layout.onGloballyPositioned
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.mohsingdp.marifatulquran.ui.theme.LocalMqColors
import kotlin.math.atan2
import kotlin.math.cos
import kotlin.math.roundToInt
import kotlin.math.sin

/** One coachmark step: a caption anchored to (and arrow pointing at) a target element's rect. */
data class GuideStep(val title: String, val body: String, val target: Rect?)

/**
 * Full-screen guided walkthrough overlay. Dims the screen, spotlights the current step's target
 * element (transparent cutout + teal ring), draws an arrow from the caption to it, and shows a
 * caption card with Skip / Next. Tapping anywhere advances. Target rects are captured by the host
 * via Modifier.onGloballyPositioned { it.boundsInRoot() }.
 */
@Composable
fun GuideOverlay(steps: List<GuideStep>, onFinish: () -> Unit) {
    if (steps.isEmpty()) return
    val mq = LocalMqColors.current
    val density = LocalDensity.current
    var index by remember { mutableIntStateOf(0) }
    var captionRect by remember { mutableStateOf<Rect?>(null) }

    val step = steps[index]
    val target = step.target
    val isLast = index == steps.lastIndex

    fun advance() {
        if (isLast) onFinish() else index++
    }

    BoxWithConstraints(
        modifier = Modifier
            .fillMaxSize()
            .pointerInput(index) { detectTapGestures { advance() } },
    ) {
        val ringPad = with(density) { 8.dp.toPx() }
        val ringStroke = with(density) { 2.5.dp.toPx() }
        val gap = with(density) { 16.dp.toPx() }
        val arrowStroke = with(density) { 3.dp.toPx() }
        val screenH = constraints.maxHeight.toFloat()

        // Caption goes below a top-half target, above a bottom-half target.
        val captionBelow = target == null || target.center.y < screenH * 0.5f
        val captionHpx = captionRect?.height ?: with(density) { 150.dp.toPx() }
        val captionTopPx = when {
            target == null -> screenH * 0.4f
            captionBelow -> target.bottom + ringPad + gap
            else -> (target.top - ringPad - gap - captionHpx).coerceAtLeast(gap)
        }

        // ---- Scrim + spotlight cutout + ring + arrow ----
        Canvas(
            modifier = Modifier
                .fillMaxSize()
                .graphicsLayer(compositingStrategy = CompositingStrategy.Offscreen),
        ) {
            drawRect(Color.Black.copy(alpha = 0.76f))
            if (target != null) {
                val tl = Offset(target.left - ringPad, target.top - ringPad)
                val sz = Size(target.width + ringPad * 2, target.height + ringPad * 2)
                val corner = CornerRadius(14.dp.toPx(), 14.dp.toPx())
                drawRoundRect(color = Color.Transparent, topLeft = tl, size = sz, cornerRadius = corner, blendMode = BlendMode.Clear)
                drawRoundRect(color = mq.tealAccent, topLeft = tl, size = sz, cornerRadius = corner, style = Stroke(width = ringStroke))
            }
            // Arrow from the caption edge to the target.
            val cap = captionRect
            if (target != null && cap != null) {
                val ax = target.center.x.coerceIn(cap.left + 24f, cap.right - 24f)
                val start: Offset
                val end: Offset
                if (captionBelow) {
                    start = Offset(ax, cap.top - 4f)
                    end = Offset(target.center.x, target.bottom + ringPad + 6f)
                } else {
                    start = Offset(ax, cap.bottom + 4f)
                    end = Offset(target.center.x, target.top - ringPad - 6f)
                }
                drawArrow(start, end, mq.gold, arrowStroke, with(density) { 11.dp.toPx() })
            }
        }

        // ---- Caption card ----
        Column(
            modifier = Modifier
                .align(Alignment.TopStart)
                .offset { IntOffset(with(density) { 16.dp.roundToPx() }, captionTopPx.roundToInt()) }
                .width(this.maxWidth - 32.dp)
                .onGloballyPositioned { captionRect = it.boundsInRoot() }
                .background(mq.cardBg, RoundedCornerShape(14.dp))
                .border(1.dp, mq.tealAccent.copy(alpha = 0.5f), RoundedCornerShape(14.dp))
                .padding(horizontal = 18.dp, vertical = 16.dp),
        ) {
            Text(
                text = "Step ${index + 1} of ${steps.size}",
                color = mq.tealAccent,
                fontSize = 12.sp,
                fontWeight = FontWeight.Bold,
                letterSpacing = 0.5.sp,
            )
            Spacer(Modifier.height(6.dp))
            Text(step.title, color = mq.textPrimary, fontSize = 18.sp, fontWeight = FontWeight.Bold)
            Spacer(Modifier.height(6.dp))
            Text(step.body, color = mq.textMuted, fontSize = 14.sp)
            Spacer(Modifier.height(14.dp))
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically,
            ) {
                TextButton(onClick = onFinish) {
                    Text("Skip", color = mq.textMuted)
                }
                // Pill "Next" / "Got it" button (teal).
                Text(
                    text = if (isLast) "Got it" else "Next",
                    color = Color.White,
                    fontSize = 15.sp,
                    fontWeight = FontWeight.Bold,
                    modifier = Modifier
                        .background(mq.tealAccent, RoundedCornerShape(20.dp))
                        .pointerInput(index) { detectTapGestures { advance() } }
                        .padding(horizontal = 22.dp, vertical = 9.dp),
                )
            }
        }
    }
}

/** Draws a straight arrow shaft from [start] to [end] with a "V" arrowhead at [end]. */
private fun androidx.compose.ui.graphics.drawscope.DrawScope.drawArrow(
    start: Offset,
    end: Offset,
    color: Color,
    stroke: Float,
    head: Float,
) {
    drawLine(color = color, start = start, end = end, strokeWidth = stroke, cap = androidx.compose.ui.graphics.StrokeCap.Round)
    val angle = atan2((end.y - start.y).toDouble(), (end.x - start.x).toDouble())
    val a1 = angle + Math.toRadians(150.0)
    val a2 = angle - Math.toRadians(150.0)
    val p = Path().apply {
        moveTo(end.x, end.y)
        lineTo(end.x + (head * cos(a1)).toFloat(), end.y + (head * sin(a1)).toFloat())
        moveTo(end.x, end.y)
        lineTo(end.x + (head * cos(a2)).toFloat(), end.y + (head * sin(a2)).toFloat())
    }
    drawPath(p, color = color, style = Stroke(width = stroke, cap = androidx.compose.ui.graphics.StrokeCap.Round))
}
