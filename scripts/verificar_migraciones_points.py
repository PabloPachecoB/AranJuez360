import os,sys,tempfile,uuid
from pathlib import Path
sys.path.insert(0,str(Path('backend').resolve()))
os.environ['DJANGO_SETTINGS_MODULE']='paseo_erp.settings'
os.environ['DEBUG']='True';os.environ['USE_LOCAL_DB']='True'
import django
django.setup()
from django.db import connection
from django.db.migrations.executor import MigrationExecutor
from decimal import Decimal
for branch,migration in [('points','0003_movimientopuntos_pedido_recompensa_cupon_and_more'),('main','0005_canje')]:
    connection.close()
    db=Path(tempfile.mkdtemp(prefix='paseo-migracion-'))/'test.sqlite3'
    connection.settings_dict['NAME']=str(db)
    executor=MigrationExecutor(connection)
    targets=[('fidelizacion',migration),('usuarios','0002_usuario_acepto_terminos_en_usuario_ci_and_more')]
    executor.migrate(targets)
    apps=executor.loader.project_state(targets).apps
    User=apps.get_model('usuarios','Usuario');Reward=apps.get_model('fidelizacion','Recompensa');Company=apps.get_model('empresas','Empresa')
    user=User.objects.create(username='migracion',puntos_saldo=125)
    company=Company.objects.create(nombre='Conservar empresa')
    reward=Reward.objects.create(nombre='Conservar premio',costo_puntos=25,**{('negocio' if branch=='points' else 'empresa'):company})
    if branch=='points':
        Move=apps.get_model('fidelizacion','MovimientoPuntos')
        move=Move.objects.create(cliente=user,puntos=-25,tipo='CANJE')
        coupon=apps.get_model('fidelizacion','Cupon').objects.create(cliente=user,recompensa=reward,nombre=reward.nombre,descripcion='Condición original',costo_puntos=25,negocio=company,movimiento=move,clave_operacion=uuid.uuid4())
        code=coupon.codigo
    else:
        canje=apps.get_model('fidelizacion','Canje').objects.create(cliente=user,recompensa=reward,monedas=25)
        code=canje.codigo
    executor=MigrationExecutor(connection)
    executor.migrate(executor.loader.graph.leaf_nodes())
    from usuarios.models import Usuario
    from fidelizacion.models import Recompensa,Cupon,Canje,MovimientoPuntos
    assert Usuario.objects.get(pk=user.pk).puntos_saldo==125
    assert Recompensa.objects.get(pk=reward.pk).empresa_id==company.pk
    assert Cupon.objects.get(codigo=code).costo_puntos==25
    assert Canje.objects.get(codigo=code).cupon.codigo==code
    assert MovimientoPuntos.objects.count()==(1 if branch=='points' else 0)
    print(branch, '-> integrada: saldo, empresa, código y movimientos conservados')
connection.close()
