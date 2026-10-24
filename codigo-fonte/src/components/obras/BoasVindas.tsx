import React from 'react';
import {Workspace} from '../../services/obrasApi';
import {ObrasPage} from './ObrasPage';

export function BoasVindas(props:{workspace:Workspace;flush:()=>Promise<unknown>;importing:boolean}){
 return <ObrasPage {...props} boasVindas/>;
}
