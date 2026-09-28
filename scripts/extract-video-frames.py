"""Save a few real video frames for bounded visual analysis."""
import argparse
import json
from pathlib import Path

import av
from PIL import Image


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("input")
    parser.add_argument("output")
    args = parser.parse_args()
    source = Path(args.input)
    target = Path(args.output)
    if not source.is_file() or source.stat().st_size > 600 * 1024 * 1024:
        raise ValueError("Missing video or video exceeds 600 MB")

    target.mkdir(parents=True, exist_ok=True)
    with av.open(str(source)) as container:
        stream = container.streams.video[0]
        duration = float(container.duration or 0) / av.time_base
        if duration <= 0:
            raise ValueError("Video duration is unavailable")
        positions = [min(duration - 0.1, max(0, duration * fraction)) for fraction in (0.1, 0.35, 0.65, 0.9)]
        results = []
        for index, second in enumerate(positions, 1):
            container.seek(int(second / stream.time_base), stream=stream, backward=True)
            for frame in container.decode(stream):
                frame_time = float(frame.time or 0)
                if frame_time + 0.05 < second:
                    continue
                image = frame.to_image().convert("RGB")
                image.thumbnail((960, 960), Image.Resampling.LANCZOS)
                file = target / f"{index:02d}.jpg"
                image.save(file, "JPEG", quality=78, optimize=True)
                results.append({"time": round(frame_time, 2), "file": file.name})
                break
        if not results:
            raise ValueError("No video frame could be decoded")
    print(json.dumps(results, ensure_ascii=False))


if __name__ == "__main__":
    main()
