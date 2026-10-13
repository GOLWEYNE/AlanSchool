import json, sys
SLOTS = [("08:55","09:40"),("09:40","10:25"),("10:25","11:10"),("11:10","11:55"),("11:55","13:00"),("13:00","14:00"),("14:00","15:00"),("15:00","16:00"),("16:00","17:30")]
DAYS = {"MON":1,"TUE":2,"WED":3,"THU":4,"FRI":5}
out=[]; cur=None; row=0
for line in open("scripts/duty_source.txt", encoding="utf-8"):
    line=line.strip()
    if not line or line.startswith("#"): continue
    if line[0]=="F" and len(line.split())==2 and line.split()[1] in DAYS:
        f,d=line.split(); cur=(int(f[1]),DAYS[d]); row=0; continue
    left,right=[p.strip() for p in line.split("|")]
    s,e=SLOTS[row]
    for block,cell in (("1-2",left),("3-4",right)):
        out.append({"floor":cur[0],"weekday":cur[1],"block":block,"start":s,"end":e,"teachers":[t.strip() for t in cell.split("/")]})
    row+=1
assert len(out)==270, len(out)
assert sum(len(o["teachers"]) for o in out)==280
json.dump(out, open("src/lib/dutySeed.json","w",encoding="utf-8"), ensure_ascii=False, indent=0)
names=sorted({t for o in out for t in o["teachers"]})
print(len(out),"slots;",sum(len(o["teachers"]) for o in out),"assignments;",len(names),"distinct names")
