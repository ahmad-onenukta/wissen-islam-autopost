#!/usr/bin/env python3
"""events_essay.py props.json events.json -> SFX events from essay blocks"""
import json,sys
p=json.load(open(sys.argv[1]))['script']; ev=[]
for i,b in enumerate(p['blocks']):
    if i>0: ev.append({'t':b['start'],'type':'whoosh'})
    for w in b['words']:
        if w.get('accent'): ev.append({'t':w['s'],'type':'hit'}); break
    if b.get('visual') in ('counter','range'):
        for j in range(10): ev.append({'t':b['start']+0.3+j*0.12,'type':'tick'})
        ev.append({'t':b['start']+1.6,'type':'boom'})
    if b.get('visual') in ('bars','timeline','compare','cards','document','question','quote','ayah'): ev.append({'t':b['start']+0.3,'type':'pop'})
json.dump(ev,open(sys.argv[2],'w')); print(len(ev), p['duration'])
