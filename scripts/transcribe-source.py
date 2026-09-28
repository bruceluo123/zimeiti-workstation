"""Local ASR: preserve timestamped speech, never substitute a video caption."""
import argparse
import json
from pathlib import Path
from faster_whisper import WhisperModel


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("input")
    parser.add_argument("output")
    parser.add_argument("--model", default="small")
    args = parser.parse_args()
    media = Path(args.input)
    if not media.is_file() or media.stat().st_size > 600 * 1024 * 1024:
        raise ValueError("Missing media or file exceeds 600 MB")
    model = WhisperModel(args.model, device="cpu", compute_type="int8", cpu_threads=6)
    segments, info = model.transcribe(str(media), language="zh", beam_size=5, vad_filter=True,
                                      condition_on_previous_text=False)
    rows = []
    for segment in segments:
        rows.append({"start": round(segment.start, 2), "end": round(segment.end, 2),
                     "text": segment.text.strip()})
        print(f"transcribed {segment.end:.0f}/{info.duration:.0f}s", flush=True)
    if not rows:
        raise ValueError("No speech recognized; not a successful transcript")
    result = {"text": "\n".join(row["text"] for row in rows), "segments": rows,
              "duration": info.duration, "engine": f"faster-whisper/{args.model}",
              "reviewRequired": True}
    target = Path(args.output)
    target.parent.mkdir(parents=True, exist_ok=True)
    temporary = target.with_suffix(".tmp")
    temporary.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
    temporary.replace(target)


if __name__ == "__main__":
    main()
