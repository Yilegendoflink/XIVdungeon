# XIV 地牢计算公式参考

> 状态：当前原型实现基准。本文记录代码中已经生效的计算公式；未实现的技能、装备、护盾和异常状态规则不在本文臆定。

## 1. 统一约定

- `floor(x)`：向下取整，对应代码中的 `Math.floor(x)`。
- `round(x)`：四舍五入，对应代码中的 `Math.round(x)`。
- `ceil(x)`：向上取整，对应代码中的 `Math.ceil(x)`。
- `min(a, b)` / `max(a, b)`：取较小值 / 较大值。
- 百分比属性使用千分比表示：属性值 `1000` 等于 `100%` 概率或 `100%` 增幅基准。
- 随机整数 `[min, max]` 为闭区间，最小值和最大值都有机会出现。
- 除特别说明外，伤害最终不会低于 `1`。

## 2. 符号表

| 符号 | 含义 |
| --- | --- |
| `P` | 职业主属性值，例如龙骑士当前使用力量。 |
| `B` | 当前 `might` 增益提供的攻击加成总和。 |
| `A` | 玩家攻击力。 |
| `R` | 基础伤害随机浮动，取 `-1、0、1` 之一。 |
| `D0`、`D1`、`D2`、`D3` | 伤害在不同结算阶段的中间值。 |
| `E` | 敌人攻击力。 |
| `F` | 敌人防御力折算值。 |
| `T` | 玩家坚韧属性值。 |

## 3. 玩家属性公式

### 3.1 攻击力

普通攻击使用职业定义的 `primaryAttribute`：

```text
B = sum(buff.value where buff.type == "might")
A = floor(P / 2) + B
```

当前龙骑士的主属性是力量，因此初始力量 `12`、没有增益时：

```text
A = floor(12 / 2) + 0 = 6
```

敏捷和智力当前不会影响龙骑士的普通攻击。未来技能可以通过自身的 `scalingAttribute` 选择取值属性。

当前龙骑士的初始属性基线：

| 力量 | 敏捷 | 智力 | 精神 | 坚韧 | 信仰 | 信念 | 直击 | 暴击 |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 12 | 6 | 6 | 6 | 50 | 100 | 50 | 100 | 100 |

这组数值对应初始 `25 HP`、`12 MP`、`6` 点攻击力和 `2` 点防御力。

### 3.2 最大 HP

```text
maxHp = 20 + floor(tenacity / 10)
```

玩家创建时：

```text
hp = maxHp
```

当前龙骑士初始坚韧为 `50`，因此初始生命值为：

```text
maxHp = 20 + floor(50 / 10) = 25
```

### 3.3 MP 回复

当前 MP 最大值固定为 `12`。常规回合结束时，MP 回复量为：

```text
regen = 1 + floor(piety / 100)
mp' = min(maxMp, mp + regen)
```

当前龙骑士信仰为 `100`，每个常规回合回复 `2` 点 MP，但不会超过最大 MP。

### 3.4 MP 消耗修正

技能系统尚未接入，但 MP 消耗函数已经定义：

```text
cost' = max(1, ceil(cost * (1 - min(0.5, piety / 1000))))
```

信仰最多降低 `50%` 的 MP 消耗，修正后的消耗最低为 `1`。

### 3.5 等级与经验

当前满级为 `30`。从当前等级升至下一级所需经验为：

```text
required(level) = 10 * level^2, 1 <= level < 30
required(level) = 0,              level >= 30
```

获得经验时：

```text
experience = experience + gained

while level < 30 and experience >= required(level):
    experience = experience - required(level)
    level = level + 1

if level == 30:
    experience = 0
```

示例：

- 1 级升 2 级需要 `10` 点经验。
- 2 级升 3 级需要 `40` 点经验。
- 1 级一次获得 `50` 点经验时，连续升级到 3 级，剩余经验为 `0`。
- 达到 30 级后，不再累积用于升级的经验。

## 4. 攻击距离公式

普通攻击最大距离为 `2` 格。

```text
distance = shortestTerrainPath(hero, enemy).length
canAttack = distance != null and distance <= 2
```

当前寻路规则：

- 使用 8 方向网格，横向、纵向和斜向各移动 `1` 格。
- 墙体不可通行。
- 斜向移动不能穿过两个阻挡地形形成的对角缝隙。
- 没有可行路径时，距离为无效值，攻击失败。
- 因此攻击距离不是简单的坐标差，必须经过地形寻路计算。

## 5. 随机数公式

战斗中的随机整数使用闭区间：

```text
randInt(min, max) = min + floor(random() * (max - min + 1))
```

基础伤害的随机浮动为：

```text
R = randInt(-1, 1)
```

因此 `R` 只有 `-1`、`0`、`1` 三种结果，理论上等概率出现。

## 6. 玩家普通攻击伤害

### 6.1 基础伤害

目标防御力先折算为一半：

```text
F = floor(enemy.def / 2)
D0 = max(1, A - F + R)
```

### 6.2 信念增伤

```text
D1 = round(D0 * (1 + determination / 1000))
```

例如信念为 `100` 时，伤害乘以 `1.1`。

### 6.3 直击

直击触发概率为：

```text
pDirect = min(1, directHit / 1000)
```

触发后：

```text
D2 = round(D1 * 1.4)
```

未触发时：

```text
D2 = D1
```

当前版本的直击不会造成未命中，`directHit` 只负责直击触发概率和 `40%` 增伤。

### 6.4 暴击

暴击触发概率为：

```text
pCritical = min(1, criticalHit / 1000)
```

暴击倍率为：

```text
criticalMultiplier = 1.5 + min(0.5, criticalHit / 2000)
```

因此暴击倍率最低为 `1.5`，最高为 `2.0`。触发暴击时：

```text
D3 = round(D2 * criticalMultiplier)
```

未触发时：

```text
D3 = D2
```

### 6.5 最终玩家伤害

完整顺序为：

```text
A  = floor(P / 2) + B
D0 = max(1, A - floor(enemy.def / 2) + R)
D1 = round(D0 * (1 + determination / 1000))
D2 = directHit ? round(D1 * 1.4) : D1
D3 = critical ? round(D2 * criticalMultiplier) : D2
D  = max(1, D3)
```

直击和暴击可以在同一次攻击中同时触发，结算顺序为：

```text
信念 -> 直击 -> 暴击
```

每个阶段独立取整。

## 7. 敌人攻击玩家

敌人的原始伤害使用与基础伤害相同的防御折算和随机浮动：

```text
D0 = max(1, enemy.atk - floor(hero.def / 2) + R)
```

玩家坚韧减伤：

```text
damageReduction = min(0.5, tenacity / 1000)
D = max(1, floor(D0 * (1 - damageReduction)))
```

坚韧最多提供 `50%` 减伤。敌人伤害正常不会低于 `1`。

## 8. 修改器覆盖规则

### 一击必杀

玩家攻击公式仍会正常执行，但最终作用到敌人身上的伤害被替换为敌人当前 HP：

```text
damageToEnemy = enemy.hp
```

### 无限血量

敌人伤害仍会被计算并生成伤害反馈，但玩家 HP 在受击后保持最大值：

```text
hero.hp = hero.maxHp
```

### 每层直接完成目标

普通楼层生成后，将目标进度设置为目标值并解锁出口；最终 Boss 层仍需正常击败 Boss。

## 9. 击杀奖励

普通敌人的经验和 Gil 分别从各自配置的闭区间中随机取得：

```text
experience = randInt(enemy.experience.min, enemy.experience.max)
gil = randInt(enemy.gil.min, enemy.gil.max)
```

Boss 奖励倍率为 `2`：

```text
multiplier = enemy.isBoss ? 2 : 1
experience = randInt(enemy.experience.min * multiplier, enemy.experience.max * multiplier)
gil = randInt(enemy.gil.min * multiplier, enemy.gil.max * multiplier)
```

当前配置：

| 敌人 | HP | 攻击 | 防御 | 经验 | Gil |
| --- | ---: | ---: | ---: | ---: | ---: |
| 炸弹怪 | 8 | 3 | 0 | 2-4 | 1-3 |
| 仙人掌怪 | 6 | 2 | 0 | 3-6 | 2-5 |
| 魔界花 | 24 | 5 | 2 | 12-18 | 8-14 |

最终 Boss 使用魔界花的强化参数：

```text
hp  = round(24 * 1.5) = 36
atk = 5 + 2 = 7
def = 2 + 1 = 3
```

## 10. 敌人生成限制

每层敌人生成受两项限制：

```text
enemy.power <= floorRule.maxPower
sum(enemy.power) <= floorRule.powerBudget
```

当前各层规则：

| 楼层 | 最大单体强度 | 总强度预算 |
| --- | ---: | ---: |
| 1-2 | 1 | 10 |
| 3 | 2 | 14 |
| 4 | 2 | 16 |
| 5 | 4 | 18 |
| 6 及以后 | 8 | 24 |

击败数量目标的目标数为：

```text
target = 5 + floor(random() * 6)
```

因此目标数为闭区间 `[5, 10]`。特定敌人目标在当前楼层只生成一个特殊敌人。

## 11. 当前未接入的公式

以下内容目前没有参与实际伤害或成长结算：

- 精神对回复量的具体公式。
- 等级对属性或伤害的自动成长。
- 技能威力、技能资源消耗和技能取值属性。
- 装备属性、武器倍率和护盾。
- 持续伤害、异常状态和独立命中失败规则。
- 局外成长以及跨局属性修正。

新增系统时，应在本文补充公式，并同步对应的实现测试。
