package ai.adflow.api.store.persona;

import ai.adflow.api.store.StoreController;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/stores/personas")
public class PersonaController extends StoreController<Persona> {

  public PersonaController(PersonaRepository repository) {
    super(repository);
  }
}
