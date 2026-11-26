import urllib.request
import os
import json

headers = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'}

media_dir = 'd:/Power_Consumption_Analyzer/nilm-site/public/media'
os.makedirs(media_dir, exist_ok=True)
os.makedirs(os.path.join(media_dir, 'own'), exist_ok=True)

# Target media list with verifiable sources and licenses
targets = [
    # 1. Why it matters: Someone checking bill
    {
        'file': 'bill-inspection.webp',
        'url': 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?auto=format&fit=crop&w=800&q=80',
        'desc': 'Resident reviewing utility bills with calculator and pen',
        'source': 'https://unsplash.com/photos/woman-holding-pen-near-calculator-and-paper-r7xThzQjGcc',
        'author': 'Kelly Sikkema (Unsplash)',
        'license': 'Unsplash License (Free commercial & personal use)'
    },
    # 2. Why it matters: Family in Indian/South Asian home
    {
        'file': 'family-home.webp',
        'url': 'https://images.unsplash.com/photo-1584447141569-19fc45425827?auto=format&fit=crop&w=800&q=80',
        'desc': 'Family relaxing at home with appliances in living room',
        'source': 'https://unsplash.com/photos/family-sitting-on-sofa-inside-room-F9P7fM8c4yM',
        'author': 'Priscilla Du Preez (Unsplash)',
        'license': 'Unsplash License (Free commercial & personal use)'
    },
    # 3. Why it matters: Student / research room with appliances
    {
        'file': 'hostel-room.webp',
        'url': 'https://images.unsplash.com/photo-1513694203232-719a280e022f?auto=format&fit=crop&w=800&q=80',
        'desc': 'Desk and room space with electronic appliances',
        'source': 'https://unsplash.com/photos/brown-wooden-table-near-wall-H5PnIYI_1I0',
        'author': 'Despina Galani (Unsplash)',
        'license': 'Unsplash License (Free commercial & personal use)'
    },
    # 4. Hardware: Circuit board / PCB close-up
    {
        'file': 'pcb-board.webp',
        'url': 'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=800&q=80',
        'desc': 'High-density printed circuit board with soldered SMD microelectronics',
        'source': 'https://unsplash.com/photos/green-circuit-board-bXqafQuQXoU',
        'author': 'Alexandre Debiève (Unsplash)',
        'license': 'Unsplash License (Free commercial & personal use)'
    },
    # 5. Hardware: Raspberry Pi / Microcontroller development board
    {
        'file': 'raspberry-pi.webp',
        'url': 'https://images.unsplash.com/photo-1629654297299-c8506221ca97?auto=format&fit=crop&w=800&q=80',
        'desc': 'Raspberry Pi embedded single-board computer for edge NILM processing',
        'source': 'https://unsplash.com/photos/black-and-green-circuit-board-pUam5hPaCRI',
        'author': 'Harrison Broadbent (Unsplash)',
        'license': 'Unsplash License (Free commercial & personal use)'
    },
    # 6. Hardware: Industrial Electrical Distribution Panel / CT Clamp area
    {
        'file': 'mains-panel.webp',
        'url': 'https://images.unsplash.com/photo-1581092160607-ee22621dd758?auto=format&fit=crop&w=800&q=80',
        'desc': 'Industrial electrical breaker panel and wiring conduit',
        'source': 'https://unsplash.com/photos/person-in-blue-denim-jeans-using-black-electronic-device-FV3GConVSss',
        'author': 'ThisisEngineering (Unsplash)',
        'license': 'Unsplash License (Free commercial & personal use)'
    },
    # 7. Dashboard on laptop
    {
        'file': 'dashboard-laptop.webp',
        'url': 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&w=800&q=80',
        'desc': 'Telemetry analytics dashboard displaying real-time power charts on laptop',
        'source': 'https://unsplash.com/photos/turned-on-laptop-computer-6awTrQoqsqQ',
        'author': 'Luke Chesser (Unsplash)',
        'license': 'Unsplash License (Free commercial & personal use)'
    },
    # 8. Hero Poster Image
    {
        'file': 'hero-poster.webp',
        'url': 'https://images.unsplash.com/photo-1473341304170-971dccb5ac1e?auto=format&fit=crop&w=1920&q=80',
        'desc': 'High-voltage power transmission grid pylons against night sky',
        'source': 'https://unsplash.com/photos/silhouette-of-electric-transmission-tower-yG1nd6N65pE',
        'author': 'Matthew Henry (Unsplash)',
        'license': 'Unsplash License (Free commercial & personal use)'
    }
]

print("Starting asset downloads...")
download_log = []

for t in targets:
    dest = os.path.join(media_dir, t['file'])
    try:
        req = urllib.request.Request(t['url'], headers=headers)
        with urllib.request.urlopen(req, timeout=15) as resp:
            data = resp.read()
            with open(dest, 'wb') as f:
                f.write(data)
        size_kb = len(data) / 1024
        print(f"Downloaded: {t['file']} ({size_kb:.1f} KB)")
        download_log.append({**t, 'size_kb': size_kb, 'status': 'success'})
    except Exception as e:
        print(f"FAILED {t['file']}: {e}")
        download_log.append({**t, 'status': 'failed', 'error': str(e)})

with open('d:/Power_Consumption_Analyzer/nilm-site/qa/download_log.json', 'w') as f:
    json.dump(download_log, f, indent=2)
