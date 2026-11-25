const { context, trace } = require('@opentelemetry/api');

function startTracing() {
  if (!process.env.OTEL_EXPORTER_OTLP_ENDPOINT && !process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT) {
    return;
  }

  const { NodeSDK } = require('@opentelemetry/sdk-node');
  const { OTLPTraceExporter } = require('@opentelemetry/exporter-trace-otlp-http');
  const { HttpInstrumentation } = require('@opentelemetry/instrumentation-http');
  const sdk = new NodeSDK({
    traceExporter: new OTLPTraceExporter(),
    instrumentations: [new HttpInstrumentation()]
  });
  sdk.start();
  return sdk;
}

function traceFields() {
  const span = trace.getSpan(context.active());
  if (!span) return {};
  const { traceId, spanId } = span.spanContext();
  return { traceId, spanId };
}

module.exports = { startTracing, traceFields };
